import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ObservationJobsService } from './observation-jobs.service';

@Module({
  imports: [PrismaModule],
  providers: [ObservationJobsService],
  exports: [ObservationJobsService],
})
export class QueueModule {}
