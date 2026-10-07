import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { UsersModule } from '../users/users.module';
import { LexicalSearchService } from './lexical-search.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [AuthModule, UsersModule, EmbeddingsModule],
  controllers: [SearchController],
  providers: [SearchService, LexicalSearchService],
  exports: [SearchService],
})
export class SearchModule {}
