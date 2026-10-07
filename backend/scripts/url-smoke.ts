import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ObservationsService } from '../src/observations/observations.service';
import { ObservationProcessor } from '../src/observations/observation.processor';
import { UsersService } from '../src/users/users.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const observations = app.get(ObservationsService);
  const processor = app.get(ObservationProcessor);
  const users = app.get(UsersService);
  const clerkUserId = `smoke_url_${Date.now()}`;

  const obs = await observations.createFromUrl({
    clerkUserId,
    url: 'https://example.com',
  });
  console.log('url obs', obs.id, obs.filename);

  // createFromUrl already schedules processing; wait for settlement.
  let ready = obs;
  for (let i = 0; i < 60; i += 1) {
    ready = await observations.getForClerkUser(clerkUserId, obs.id);
    if (ready.status === 'COMPLETED' || ready.status === 'FAILED') break;
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log('url status', ready.status, (ready.extractedText || '').slice(0, 80));
  if (ready.status !== 'COMPLETED') {
    // Fallback: reclaim and process once if async path stalled.
    await processor.process(obs.id);
    ready = await observations.getForClerkUser(clerkUserId, obs.id);
  }
  if (ready.status !== 'COMPLETED') {
    throw new Error(ready.processingError || ready.status);
  }
  await observations.deleteForClerkUser(clerkUserId, obs.id);
  await users.deleteAllDataForClerkUser(clerkUserId);
  console.log('URL smoke PASS');
  await app.close();
}

main().catch((err) => {
  console.error('URL smoke FAIL', err);
  process.exit(1);
});
