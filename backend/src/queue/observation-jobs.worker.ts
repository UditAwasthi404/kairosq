import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ObservationJobKind, ProcessingStatus } from '@prisma/client';
import { isTestEnv } from '../config/env';
import { NotificationsService } from '../notifications/notifications.service';
import { ObservationProcessor } from '../observations/observation.processor';
import { PrismaService } from '../prisma/prisma.service';
import { ObservationJobsService } from './observation-jobs.service';

const POLL_MS = 500;

@Injectable()
export class ObservationJobsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObservationJobsWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(
    private readonly jobs: ObservationJobsService,
    private readonly processor: ObservationProcessor,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    if (isTestEnv() && process.env.ENABLE_JOB_WORKER !== 'true') {
      return;
    }
    if (process.env.SKIP_DB_CONNECT === 'true') {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      for (let i = 0; i < 8; i += 1) {
        const claimed = await this.jobs.claimNext();
        if (!claimed) return;
        const started = Date.now();
        try {
          await this.run(claimed.kind, claimed.observationId, claimed.payload);
          await this.jobs.markCompleted(claimed.id, claimed.lockToken);
          this.logger.log(
            JSON.stringify({
              event: 'observation_job',
              result: 'ok',
              jobId: claimed.id,
              observationId: claimed.observationId,
              kind: claimed.kind,
              attempts: claimed.attempts,
              durationMs: Date.now() - started,
            }),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Job failed';
          const outcome = await this.jobs.markFailedOrRetry(
            claimed.id,
            claimed.lockToken,
            message,
            claimed.attempts,
            claimed.maxAttempts,
          );
          this.logger.warn(
            JSON.stringify({
              event: 'observation_job',
              result: outcome,
              jobId: claimed.id,
              observationId: claimed.observationId,
              kind: claimed.kind,
              attempts: claimed.attempts,
              durationMs: Date.now() - started,
              error: message,
            }),
          );
          if (
            outcome === 'failed' &&
            claimed.kind !== ObservationJobKind.NOTIFY
          ) {
            await this.prisma.observation.updateMany({
              where: {
                id: claimed.observationId,
                processingStatus: { not: ProcessingStatus.COMPLETED },
              },
              data: {
                processingStatus: ProcessingStatus.FAILED,
                processingError: message.slice(0, 500),
              },
            });
          }
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  private async run(
    kind: ObservationJobKind,
    observationId: string,
    payload: { text?: string } | null,
  ): Promise<void> {
    if (kind === ObservationJobKind.REINDEX) {
      await this.processor.reindexFromText(observationId, payload?.text ?? '');
      return;
    }
    if (kind === ObservationJobKind.NOTIFY) {
      const row = await this.prisma.observation.findUnique({
        where: { id: observationId },
        select: {
          id: true,
          userId: true,
          originalFilename: true,
          summary: true,
          processingStatus: true,
          source: true,
        },
      });
      if (row) await this.notifications.notifyObservationSettled(row);
      return;
    }
    await this.processor.process(observationId);
  }
}
