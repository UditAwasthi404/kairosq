import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { DevicesController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [DevicesController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
