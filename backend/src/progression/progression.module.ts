import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ProgressionController } from './progression.controller';
import { ProgressionService } from './progression.service';
import { DefaultRewardPolicy, REWARD_POLICY } from './reward.policy';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [ProgressionController],
  providers: [
    ProgressionService,
    { provide: REWARD_POLICY, useClass: DefaultRewardPolicy },
  ],
  exports: [ProgressionService],
})
export class ProgressionModule {}
