/**
 * Live DB smoke for MVP capture → process → delete.
 * Run: npx ts-node -r tsconfig-paths/register scripts/mvp-smoke.ts
 * Requires DATABASE_URL and working storage/embedding config.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ObservationsService } from '../src/observations/observations.service';
import { ObservationProcessor } from '../src/observations/observation.processor';
import { SearchService } from '../src/search/search.service';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const users = app.get(UsersService);
  const observations = app.get(ObservationsService);
  const processor = app.get(ObservationProcessor);
  const search = app.get(SearchService);
  const prisma = app.get(PrismaService);

  const clerkUserId = `smoke_clerk_${Date.now()}`;
  const user = await users.findOrCreateByClerkId(clerkUserId);
  console.log('user', user.id);

  const note = await observations.createFromText({
    clerkUserId,
    title: 'Smoke Redis Note',
    text: 'Kairos smoke test: Redis is used for caching in production systems.',
  });
  console.log('created note', note.id, note.status);

  let ready = note;
  for (let i = 0; i < 60; i += 1) {
    ready = await observations.getForClerkUser(clerkUserId, note.id);
    if (ready.status === 'COMPLETED' || ready.status === 'FAILED') break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (ready.status !== 'COMPLETED') {
    await processor.process(note.id);
    ready = await observations.getForClerkUser(clerkUserId, note.id);
  }
  console.log('processed', ready.status, ready.stageLabel);

  if (ready.status !== 'COMPLETED') {
    throw new Error(`Expected COMPLETED, got ${ready.status}: ${ready.processingError}`);
  }

  const results = await search.search(clerkUserId, {
    query: 'Redis caching',
    limit: 5,
  });
  console.log('search hits', results.total);
  if (results.total < 1) {
    throw new Error('Expected search hits for smoke note');
  }

  await observations.deleteForClerkUser(clerkUserId, note.id);
  const gone = await prisma.observation.findUnique({ where: { id: note.id } });
  if (gone) throw new Error('Observation still exists after delete');

  const after = await search.search(clerkUserId, {
    query: 'Redis caching',
    limit: 5,
  });
  if (after.results.some((r) => r.observationId === note.id)) {
    throw new Error('Deleted observation still searchable');
  }
  console.log('delete verified');

  await users.deleteAllDataForClerkUser(clerkUserId);
  console.log('user data deleted');
  await app.close();
  console.log('MVP smoke PASS');
}

main().catch(async (err) => {
  console.error('MVP smoke FAIL', err);
  process.exit(1);
});
