import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [TopicsController],
  providers: [TopicsService],
  exports: [TopicsService],
})
export class TopicsModule {}
