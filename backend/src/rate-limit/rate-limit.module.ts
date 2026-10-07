import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DistributedRateLimiter } from './distributed-rate-limiter';

@Module({
  imports: [PrismaModule],
  providers: [DistributedRateLimiter],
  exports: [DistributedRateLimiter],
})
export class RateLimitModule {}
