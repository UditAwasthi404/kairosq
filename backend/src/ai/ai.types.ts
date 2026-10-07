export type ExtractedTopic = {
  name: string;
  confidence?: number;
};

export type ExtractedEntity = {
  name: string;
  type:
    | 'PERSON'
    | 'ORGANIZATION'
    | 'TECHNOLOGY'
    | 'PRODUCT'
    | 'LOCATION'
    | 'CONCEPT';
  confidence?: number;
};

export type DocumentAnalysis = {
  summary: string;
  topics: ExtractedTopic[];
  entities: ExtractedEntity[];
  provider: string;
  model: string;
};

/** Context item supplied to the LLM for grounded Q&A (refs are backend-assigned). */
export type GroundedContextItem = {
  ref: number;
  chunkId: string;
  observationId: string;
  title: string;
  content: string;
  createdAt: string;
  similarity: number;
};

export type GroundedAnswerResult = {
  answer: string;
  citationRefs: number[];
  provider: string;
  model: string;
};

export type ConversationHistoryTurn = {
  role: 'USER' | 'ASSISTANT';
  content: string;
};

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type AudioTranscriptionResult = {
  text: string;
  provider: string;
  model: string;
};

export interface AIProvider {
  readonly name: string;
  isConfigured(): boolean;
  summarize(text: string): Promise<string>;
  extractTopics(text: string): Promise<ExtractedTopic[]>;
  extractEntities(text: string): Promise<ExtractedEntity[]>;
  analyzeDocument(chunks: string[]): Promise<DocumentAnalysis>;
  generateGroundedAnswer(params: {
    question: string;
    context: GroundedContextItem[];
    conversationHistory?: ConversationHistoryTurn[];
  }): Promise<GroundedAnswerResult>;
  transcribeAudio(
    buffer: Buffer,
    mimeType: string,
  ): Promise<AudioTranscriptionResult>;
}
