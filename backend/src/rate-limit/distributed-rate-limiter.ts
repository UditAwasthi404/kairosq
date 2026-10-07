import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Distributed sliding-window limiter using Postgres.
 * Advisory-locks the bucket so concurrent instances cannot overshoot.
 */
@Injectable()
export class DistributedRateLimiter {
  constructor(private readonly prisma: PrismaService) {}

  async remaining(
    bucketKey: string,
    perMinute: number,
    perDay: number,
    now = Date.now(),
  ): Promise<number> {
    const minuteCount = await this.countSince(bucketKey, now - 60_000);
    const dayCount = await this.countSince(bucketKey, now - 86_400_000);
    return Math.max(0, Math.min(perMinute - minuteCount, perDay - dayCount));
  }

  async tryConsumeUpTo(
    bucketKey: string,
    count: number,
    perMinute: number,
    perDay: number,
    now = Date.now(),
  ): Promise<number> {
    if (count <= 0) return 0;
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${bucketKey}))`;
      const minuteCount = await countSinceTx(tx, bucketKey, now - 60_000);
      const dayCount = await countSinceTx(tx, bucketKey, now - 86_400_000);
      const allowed = Math.max(
        0,
        Math.min(count, perMinute - minuteCount, perDay - dayCount),
      );
      if (allowed <= 0) return 0;
      const createdAt = new Date(now);
      await tx.rateLimitEvent.createMany({
        data: Array.from({ length: allowed }, () => ({
          bucketKey,
          createdAt,
        })),
      });
      return allowed;
    });
  }

  async prune(olderThanMs = 86_400_000): Promise<void> {
    await this.prisma.rateLimitEvent.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - olderThanMs) } },
    });
  }

  private async countSince(
    bucketKey: string,
    sinceMs: number,
  ): Promise<number> {
    return this.prisma.rateLimitEvent.count({
      where: {
        bucketKey,
        createdAt: { gte: new Date(sinceMs) },
      },
    });
  }
}

async function countSinceTx(
  tx: Prisma.TransactionClient,
  bucketKey: string,
  sinceMs: number,
): Promise<number> {
  return tx.rateLimitEvent.count({
    where: {
      bucketKey,
      createdAt: { gte: new Date(sinceMs) },
    },
  });
}
