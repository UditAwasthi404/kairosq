import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AskModule } from './ask/ask.module';
import { AuthModule } from './auth/auth.module';
import { EntitiesModule } from './entities/entities.module';
import { ObservationsModule } from './observations/observations.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { RecallModule } from './recall/recall.module';
import { SearchModule } from './search/search.module';
import { StorageModule } from './storage/storage.module';
import { TopicsModule } from './topics/topics.module';
import { UsersModule } from './users/users.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { InsightsModule } from './insights/insights.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProgressionModule } from './progression/progression.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    StorageModule,
    ObservationsModule,
    SearchModule,
    AskModule,
    TopicsModule,
    EntitiesModule,
    ProjectsModule,
    EntitlementsModule,
    InsightsModule,
    NotificationsModule,
    ProgressionModule,
    RecallModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
