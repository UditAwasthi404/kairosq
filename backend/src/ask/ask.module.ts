import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { ObservationsModule } from '../observations/observations.module';
import { SearchModule } from '../search/search.module';
import { UsersModule } from '../users/users.module';
import { AskController } from './ask.controller';
import { AskService } from './ask.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { RagContextBuilder } from './rag-context.builder';

@Module({
  imports: [AuthModule, UsersModule, SearchModule, ObservationsModule, AiModule],
  controllers: [AskController, ConversationsController],
  providers: [AskService, ConversationsService, RagContextBuilder],
  exports: [AskService, ConversationsService],
})
export class AskModule {}
