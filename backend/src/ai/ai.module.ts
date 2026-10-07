import { Module } from '@nestjs/common';
import { AI_PROVIDER, type AIProvider } from './ai.types';
import { GeminiProvider } from './gemini.provider';
import { OpenAICompatibleProvider } from './openai-compatible.provider';

export function createChatProvider(): AIProvider {
  const kind = (process.env.AI_PROVIDER ?? 'gemini').toLowerCase();
  if (kind === 'openai' || kind === 'openai-compatible') {
    return new OpenAICompatibleProvider();
  }
  return new GeminiProvider();
}

@Module({
  providers: [
    GeminiProvider,
    OpenAICompatibleProvider,
    {
      provide: AI_PROVIDER,
      useFactory: createChatProvider,
    },
  ],
  exports: [AI_PROVIDER, GeminiProvider, OpenAICompatibleProvider],
})
export class AiModule {}
