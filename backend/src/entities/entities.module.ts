import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { EntitiesController } from './entities.controller';
import { EntitiesService } from './entities.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [EntitiesController],
  providers: [EntitiesService],
  exports: [EntitiesService],
})
export class EntitiesModule {}
