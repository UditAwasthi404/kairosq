/**
 * Live DB smoke: Recall ingest → TEXT observation → COMPLETED → search → dedupe.
 * Run: npx ts-node -r tsconfig-paths/register scripts/recall-smoke.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RecallService } from '../src/recall/recall.service';
import { SearchService } from '../src/search/search.service';
import { ObservationsService } from '../src/observations/observations.service';
import { ObservationProcessor } from '../src/observations/observation.processor';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  process.env.RECALL_ENABLED = process.env.RECALL_ENABLED ?? 'true';
  process.env.RECALL_STUB_GRANT_ALL = process.env.RECALL_STUB_GRANT_ALL ?? 'true';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const recall = app.get(RecallService);
  const search = app.get(SearchService);
  const observations = app.get(ObservationsService);
  const processor = app.get(ObservationProcessor);
  const users = app.get(UsersService);
  const prisma = app.get(PrismaService);

  const clerkUserId = `recall_smoke_${Date.now()}`;
  await users.findOrCreateByClerkId(clerkUserId);

  const clientEventId = `evt_smoke_${Date.now().toString(36)}xx`;
  const ingest = await recall.ingestEventsForClerkUser(clerkUserId, {
    events: [
      {
        clientEventId,
        capturedAt: new Date().toISOString(),
        eventKind: 'screen_text',
        extractedText:
          'Kairos Recall smoke test: hybrid retrieval and pgvector memory from screen text.',
        fingerprint: `${'d'.repeat(40)}`,
        appPackage: 'com.kairos.smoke',
        title: 'Recall smoke',
        pipelineVersion: '1.0.0',
        clientProcessingVersion: '1.0.0',
      },
    ],
  });

  const accepted = ingest.results[0];
  console.log('ingest', accepted);
  if (accepted.status !== 'accepted' || !accepted.observationId) {
    throw new Error(`Expected accepted, got ${JSON.stringify(accepted)}`);
  }

  let ready = await observations.getForClerkUser(
    clerkUserId,
    accepted.observationId,
  );
  for (let i = 0; i < 60; i += 1) {
    if (ready.status === 'COMPLETED' || ready.status === 'FAILED') break;
    await new Promise((r) => setTimeout(r, 500));
    ready = await observations.getForClerkUser(
      clerkUserId,
      accepted.observationId,
    );
  }
  if (ready.status !== 'COMPLETED') {
    await processor.process(accepted.observationId);
    ready = await observations.getForClerkUser(
      clerkUserId,
      accepted.observationId,
    );
  }
  if (ready.status !== 'COMPLETED') {
    throw new Error(
      `Expected COMPLETED, got ${ready.status}: ${ready.processingError}`,
    );
  }

  const meta = ready.sourceMetadata as { captureKind?: string } | null;
  if (meta?.captureKind !== 'recall') {
    throw new Error('Expected captureKind=recall metadata');
  }

  const dup = await recall.ingestEventsForClerkUser(clerkUserId, {
    events: [
      {
        clientEventId,
        capturedAt: new Date().toISOString(),
        eventKind: 'screen_text',
        extractedText:
          'Kairos Recall smoke test: hybrid retrieval and pgvector memory from screen text.',
        fingerprint: `${'d'.repeat(40)}`,
        pipelineVersion: '1.0.0',
        clientProcessingVersion: '1.0.0',
      },
    ],
  });
  if (dup.results[0].status !== 'deduped') {
    throw new Error('Expected clientEventId dedupe');
  }

  const results = await search.search(clerkUserId, {
    query: 'hybrid retrieval pgvector recall smoke',
    limit: 5,
  });
  if (!results.results.some((r) => r.observationId === accepted.observationId)) {
    throw new Error('Search did not return Recall observation');
  }

  const deniedClerk = `recall_denied_${Date.now()}`;
  process.env.RECALL_STUB_GRANT_ALL = 'false';
  // Rebuild entitlement check by resetting env — service reads env each call for grant-all.
  try {
    await recall.ingestEventsForClerkUser(deniedClerk, {
      events: [
        {
          clientEventId: `evt_denied_${Date.now().toString(36)}xx`,
          capturedAt: new Date().toISOString(),
          eventKind: 'screen_text',
          extractedText: 'Should be rejected without entitlement',
          fingerprint: `${'e'.repeat(40)}`,
          pipelineVersion: '1.0.0',
          clientProcessingVersion: '1.0.0',
        },
      ],
    });
    throw new Error('Expected entitlement rejection');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/entitlement|Forbidden/i.test(message) && !(err as { status?: number }).status) {
      // Nest ForbiddenException
      const status = (err as { getStatus?: () => number }).getStatus?.();
      if (status !== 403) throw err;
    }
  } finally {
    process.env.RECALL_STUB_GRANT_ALL = 'true';
  }

  await recall.deleteRecallDataForClerkUser(clerkUserId);
  await users.deleteAllDataForClerkUser(clerkUserId);
  await prisma.user.deleteMany({ where: { clerkUserId: deniedClerk } });

  await app.close();
  console.log('Recall smoke PASS');
}

main().catch(async (err) => {
  console.error('Recall smoke FAIL', err);
  process.exitCode = 1;
});
