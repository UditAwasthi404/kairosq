import { Injectable, Logger } from '@nestjs/common';
import { ObservationJobKind, ObservationJobStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type ObservationJobPayload = {
  text?: string;
};

type ClaimedJob = {
  id: string;
  observationId: string;
  kind: ObservationJobKind;
  payload: ObservationJobPayload | null;
  attempts: number;
  maxAttempts: number;
  lockToken: string;
};

const STALE_LOCK_MS = 10 * 60_000;

@Injectable()
export class ObservationJobsService {
  private readonly logger = new Logger(ObservationJobsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueueProcess(observationId: string): Promise<void> {
    await this.enqueue(observationId, ObservationJobKind.PROCESS);
  }

  async enqueueReindex(observationId: string, text: string): Promise<void> {
    await this.enqueue(observationId, ObservationJobKind.REINDEX, { text });
  }

  async enqueueNotify(observationId: string): Promise<void> {
    await this.enqueue(observationId, ObservationJobKind.NOTIFY);
  }

  private async enqueue(
    observationId: string,
    kind: ObservationJobKind,
    payload?: ObservationJobPayload,
  ): Promise<void> {
    const open = await this.prisma.observationJob.findFirst({
      where: {
        observationId,
        kind,
        status: {
          in: [ObservationJobStatus.PENDING, ObservationJobStatus.ACTIVE],
        },
      },
      select: { id: true },
    });
    if (open) {
      if (payload) {
        await this.prisma.observationJob.update({
          where: { id: open.id },
          data: { payload: payload as object, availableAt: new Date() },
        });
      }
      return;
    }

    await this.prisma.observationJob.create({
      data: {
        observationId,
        kind,
        status: ObservationJobStatus.PENDING,
        payload: payload ? (payload as object) : undefined,
        availableAt: new Date(),
      },
    });
  }

  async claimNext(): Promise<ClaimedJob | null> {
    await this.requeueStaleLocks();

    const lockToken = randomUUID();
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        observationId: string;
        kind: ObservationJobKind;
        payload: ObservationJobPayload | null;
        attempts: number;
        maxAttempts: number;
      }>
    >`
      UPDATE "observation_jobs"
      SET
        "status" = 'ACTIVE'::"ObservationJobStatus",
        "lockToken" = ${lockToken},
        "lockedAt" = NOW(),
        "attempts" = "attempts" + 1,
        "updatedAt" = NOW()
      WHERE "id" = (
        SELECT "id" FROM "observation_jobs"
        WHERE "status" = 'PENDING'::"ObservationJobStatus"
          AND "availableAt" <= NOW()
        ORDER BY "availableAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id", "observationId", "kind", "payload", "attempts", "maxAttempts"
    `;

    const row = rows[0];
    if (!row) return null;
    return { ...row, lockToken };
  }

  async markCompleted(id: string, lockToken: string): Promise<void> {
    await this.prisma.observationJob.updateMany({
      where: { id, lockToken },
      data: {
        status: ObservationJobStatus.COMPLETED,
        lockedAt: null,
        lastError: null,
      },
    });
  }

  async markFailedOrRetry(
    id: string,
    lockToken: string,
    errorMessage: string,
    attempts: number,
    maxAttempts: number,
  ): Promise<'retry' | 'failed'> {
    const safe = errorMessage.slice(0, 500);
    if (attempts >= maxAttempts) {
      await this.prisma.observationJob.updateMany({
        where: { id, lockToken },
        data: {
          status: ObservationJobStatus.FAILED,
          lockedAt: null,
          lastError: safe,
        },
      });
      return 'failed';
    }

    const delayMs = Math.min(1000 * 2 ** Math.max(0, attempts - 1), 60_000);
    await this.prisma.observationJob.updateMany({
      where: { id, lockToken },
      data: {
        status: ObservationJobStatus.PENDING,
        lockedAt: null,
        lockToken: null,
        lastError: safe,
        availableAt: new Date(Date.now() + delayMs),
      },
    });
    this.logger.warn(
      `Observation job ${id} retry ${attempts}/${maxAttempts} in ${delayMs}ms: ${safe}`,
    );
    return 'retry';
  }

  private async requeueStaleLocks(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_LOCK_MS);
    await this.prisma.observationJob.updateMany({
      where: {
        status: ObservationJobStatus.ACTIVE,
        lockedAt: { lt: cutoff },
      },
      data: {
        status: ObservationJobStatus.PENDING,
        lockedAt: null,
        lockToken: null,
        availableAt: new Date(),
      },
    });
  }
}
