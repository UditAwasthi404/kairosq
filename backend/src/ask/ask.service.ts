import { Inject, Injectable, Logger } from '@nestjs/common';
import { AI_PROVIDER, type AIProvider } from '../ai/ai.types';
import type { CaptureSource, ObservationType } from '@prisma/client';
import { ObservationsService } from '../observations/observations.service';
import {
  SearchService,
  type SemanticSearchResult,
} from '../search/search.service';
import { UsersService } from '../users/users.service';
import { type AskRequestBody, validateAskRequest } from './ask.validation';
import { resolveCitations, type AskCitation } from './citation.resolver';
import {
  buildRetrievalQuery,
  selectBoundedHistory,
} from './conversation-context';
import { ConversationsService } from './conversations.service';
import { RagContextBuilder } from './rag-context.builder';

export const NO_CONTEXT_ANSWER =
  "I couldn't find anything relevant in your Kairos memories.";

export type AskResponseData = {
  question: string;
  answer: string;
  citations: AskCitation[];
  insufficientEvidence: boolean;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
};

@Injectable()
export class AskService {
  private readonly logger = new Logger(AskService.name);

  constructor(
    private readonly search: SearchService,
    private readonly contextBuilder: RagContextBuilder,
    private readonly conversations: ConversationsService,
    private readonly users: UsersService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
    private readonly observations: ObservationsService,
  ) {}

  async ask(
    clerkUserId: string,
    body: AskRequestBody,
  ): Promise<AskResponseData> {
    const started = Date.now();
    const request = validateAskRequest(body);
    const user = await this.users.findOrCreateByClerkId(clerkUserId);

    let conversationId = request.conversationId;
    if (conversationId) {
      await this.conversations.ensureOwned(clerkUserId, conversationId);
    } else {
      const created = await this.conversations.createWithTitle(
        user.id,
        request.question,
      );
      conversationId = created.id;
    }

    let replaceAssistantId: string | undefined;
    if (request.clientRequestId) {
      const existing = await this.conversations.findIdempotentTurn(
        conversationId,
        request.clientRequestId,
      );
      if (existing?.assistantMessage?.status === 'COMPLETED') {
        return {
          question: request.question,
          answer: existing.assistantMessage.content,
          citations: parseStoredCitations(existing.assistantMessage.citations),
          insufficientEvidence:
            existing.assistantMessage.insufficientEvidence ?? true,
          conversationId,
          userMessageId: existing.userMessage.id,
          assistantMessageId: existing.assistantMessage.id,
        };
      }
      if (existing?.assistantMessage?.status === 'FAILED') {
        replaceAssistantId = existing.assistantMessage.id;
      }
    }

    const earlyEmbed = this.search.embedQuery(request.question);
    void earlyEmbed.catch(() => undefined);

    const userMessage = await this.conversations.persistUserMessage({
      conversationId,
      content: request.question,
      clientRequestId: request.clientRequestId,
    });

    const historyRows = await this.conversations.loadRecentHistory(
      conversationId,
      userMessage.id,
    );
    const history = selectBoundedHistory(
      historyRows
        .slice()
        .reverse()
        .map((row) => ({
          role: row.role,
          content: row.content,
        })),
    );
    const priorUserQuestions = history
      .filter((turn) => turn.role === 'USER')
      .map((turn) => turn.content);
    const retrievalQuery = buildRetrievalQuery(
      request.question,
      priorUserQuestions,
    );

    try {
      const queryEmbedding =
        retrievalQuery === request.question
          ? await earlyEmbed
          : await this.search.embedQuery(retrievalQuery);
      const retrievalStarted = Date.now();
      const searchResult = await this.retrieveForAsk(
        clerkUserId,
        retrievalQuery,
        request.limit,
        request.filters,
        queryEmbedding,
      );
      const retrievalMs = Date.now() - retrievalStarted;

      const contextStarted = Date.now();
      const context = this.contextBuilder.build(searchResult, {
        maxChunks: request.limit,
      });
      const contextMs = Date.now() - contextStarted;

      if (context.length === 0) {
        const assistantMessage =
          await this.conversations.persistAssistantMessage({
            conversationId,
            content: NO_CONTEXT_ANSWER,
            status: 'COMPLETED',
            citations: [],
            insufficientEvidence: true,
            replaceId: replaceAssistantId,
          });

        this.logger.log(
          JSON.stringify({
            event: 'ask_kairos',
            result: 'no_context',
            conversationId,
            requestId: request.clientRequestId ?? null,
            retrievalMs,
            contextMs,
            totalMs: Date.now() - started,
            citationCount: 0,
            historyTurns: history.length,
          }),
        );

        return {
          question: request.question,
          answer: NO_CONTEXT_ANSWER,
          citations: [],
          insufficientEvidence: true,
          conversationId,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
        };
      }

      if (!this.ai.isConfigured()) {
        throw new Error('AI provider is not configured');
      }

      const llmStarted = Date.now();
      const grounded = await this.ai.generateGroundedAnswer({
        question: request.question,
        context,
        conversationHistory: history,
      });
      const llmMs = Date.now() - llmStarted;

      const citations = resolveCitations(grounded.citationRefs, context);
      const insufficientEvidence =
        citations.length === 0 ||
        /couldn'?t find|not (enough|sufficient)|no (relevant|supporting)|do not have enough|unable to (find|answer)/i.test(
          grounded.answer,
        );

      const persistStarted = Date.now();
      const assistantMessage = await this.conversations.persistAssistantMessage(
        {
          conversationId,
          content: grounded.answer,
          status: 'COMPLETED',
          citations,
          insufficientEvidence,
          replaceId: replaceAssistantId,
        },
      );
      const persistMs = Date.now() - persistStarted;

      this.logger.log(
        JSON.stringify({
          event: 'ask_kairos',
          result: 'ok',
          conversationId,
          requestId: request.clientRequestId ?? null,
          retrievalMs,
          contextMs,
          llmMs,
          persistMs,
          totalMs: Date.now() - started,
          contextItems: context.length,
          citationCount: citations.length,
          insufficientEvidence,
          historyTurns: history.length,
          model: grounded.model,
        }),
      );

      return {
        question: request.question,
        answer: grounded.answer,
        citations,
        insufficientEvidence,
        conversationId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      };
    } catch (error) {
      const failed = await this.conversations.persistAssistantMessage({
        conversationId,
        content: 'Kairos could not answer right now. Try again.',
        status: 'FAILED',
        citations: [],
        insufficientEvidence: true,
        replaceId: replaceAssistantId,
      });

      this.logger.warn(
        JSON.stringify({
          event: 'ask_kairos',
          result: 'failed',
          conversationId,
          requestId: request.clientRequestId ?? null,
          assistantMessageId: failed.id,
          totalMs: Date.now() - started,
          error: error instanceof Error ? error.message : 'unknown',
        }),
      );

      throw error;
    }
  }

  private async retrieveForAsk(
    clerkUserId: string,
    query: string,
    limit: number,
    filters: {
      from?: Date;
      to?: Date;
      observationType?: ObservationType;
      mimeType?: string;
      topicId?: string;
      entityId?: string;
      projectId?: string;
      topic?: string;
      entity?: string;
      source?: CaptureSource;
      observationId?: string;
    },
    embedding: number[],
  ): Promise<SemanticSearchResult[]> {
    const baseFilters = {
      from: filters.from?.toISOString(),
      to: filters.to?.toISOString(),
      observationType: filters.observationType,
      mimeType: filters.mimeType,
      topicId: filters.topicId,
      entityId: filters.entityId,
      projectId: filters.projectId,
      topic: filters.topic,
      entity: filters.entity,
      source: filters.source,
    };

    const primary = await this.search.search(
      clerkUserId,
      {
        query,
        limit,
        filters: {
          ...baseFilters,
          observationId: filters.observationId,
        },
      },
      embedding,
    );

    if (!filters.observationId) {
      return primary.results;
    }

    let relatedIds = new Set<string>();
    try {
      const related = await this.observations.relatedForClerkUser(
        clerkUserId,
        filters.observationId,
      );
      relatedIds = new Set(related.map((item) => item.observationId));
    } catch {
      relatedIds = new Set();
    }

    if (relatedIds.size === 0) {
      return primary.results;
    }

    const neighbors = await this.search.search(
      clerkUserId,
      {
        query,
        limit,
        filters: {
          ...baseFilters,
          excludeObservationId: filters.observationId,
        },
      },
      embedding,
    );
    const extra = neighbors.results.filter((hit) =>
      relatedIds.has(hit.observationId),
    );
    const seen = new Set(primary.results.map((hit) => hit.chunkId));
    const merged = [...primary.results];
    for (const hit of extra) {
      if (seen.has(hit.chunkId)) continue;
      seen.add(hit.chunkId);
      merged.push(hit);
      if (merged.length >= limit) break;
    }
    return merged;
  }
}

function parseStoredCitations(value: unknown): AskCitation[] {
  if (!Array.isArray(value)) return [];
  const out: AskCitation[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.observationId === 'string' &&
      typeof row.chunkId === 'string' &&
      typeof row.title === 'string' &&
      typeof row.snippet === 'string' &&
      typeof row.createdAt === 'string'
    ) {
      out.push({
        observationId: row.observationId,
        chunkId: row.chunkId,
        title: row.title,
        snippet: row.snippet,
        createdAt: row.createdAt,
      });
    }
  }
  return out;
}
