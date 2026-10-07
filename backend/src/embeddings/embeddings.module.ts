import { Logger, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChunkEmbeddingService } from './chunk-embedding.service';
import {
  EMBEDDING_PROVIDER,
  readEmbeddingConfig,
  type EmbeddingProvider,
} from './embedding.types';
import { GeminiEmbeddingProvider } from './gemini-embedding.provider';
import { LocalDeterministicEmbeddingProvider } from './local-deterministic-embedding.provider';
import { OpenAICompatibleEmbeddingProvider } from './openai-compatible-embedding.provider';
import { VectorSearchService } from './vector-search.service';

const logger = new Logger('EmbeddingsModule');

function createEmbeddingProvider(): EmbeddingProvider {
  const config = readEmbeddingConfig();
  if (config.provider === 'local') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EMBEDDING_PROVIDER=local is not allowed in production.');
    }
    logger.warn(
      'Using local deterministic embeddings (dev/test only). Not suitable for semantic quality.',
    );
    return new LocalDeterministicEmbeddingProvider();
  }

  if (config.provider === 'gemini') {
    const gemini = new GeminiEmbeddingProvider();
    if (!gemini.isConfigured()) {
      logger.warn(
        'Gemini embedding API key missing. Set EMBEDDING_API_KEY / EMBEDDING_API_KEY_1.. or reuse AI_API_KEY*.',
      );
    } else {
      logger.log(
        `Using Gemini embeddings (keys=${gemini.apiKeyCount}, model=${gemini.model}, dimensions=${gemini.dimensions}).`,
      );
    }
    return gemini;
  }

  const openai = new OpenAICompatibleEmbeddingProvider();
  if (!openai.isConfigured()) {
    logger.warn(
      'Embedding API key missing. Set EMBEDDING_API_KEY (or AI_API_KEY), or EMBEDDING_PROVIDER=local for plumbing tests.',
    );
  }
  return openai;
}

@Module({
  imports: [PrismaModule],
  providers: [
    OpenAICompatibleEmbeddingProvider,
    GeminiEmbeddingProvider,
    LocalDeterministicEmbeddingProvider,
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: createEmbeddingProvider,
    },
    ChunkEmbeddingService,
    VectorSearchService,
  ],
  exports: [
    EMBEDDING_PROVIDER,
    ChunkEmbeddingService,
    VectorSearchService,
    OpenAICompatibleEmbeddingProvider,
    GeminiEmbeddingProvider,
    LocalDeterministicEmbeddingProvider,
  ],
})
export class EmbeddingsModule {}
