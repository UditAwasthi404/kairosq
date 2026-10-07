import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProgressionModule } from '../progression/progression.module';
import { QueueModule } from '../queue/queue.module';
import { ObservationJobsWorker } from '../queue/observation-jobs.worker';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { CaptureController } from './capture.controller';
import { ObservationProcessor } from './observation.processor';
import { ObservationsController } from './observations.controller';
import { ObservationsService } from './observations.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    StorageModule,
    AiModule,
    EmbeddingsModule,
    NotificationsModule,
    ProgressionModule,
    QueueModule,
  ],
  controllers: [ObservationsController, CaptureController],
  providers: [ObservationsService, ObservationProcessor, ObservationJobsWorker],
  exports: [ObservationsService, ObservationProcessor],
})
export class ObservationsModule {}
