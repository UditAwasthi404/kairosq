import { BadRequestException } from '@nestjs/common';
import { AskService, NO_CONTEXT_ANSWER } from './ask.service';
import { RagContextBuilder } from './rag-context.builder';

describe('AskService', () => {
  function build(overrides?: {
    searchResults?: unknown[];
    grounded?: {
      answer: string;
      citationRefs: number[];
    };
  }) {
    const search = {
      embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      search: jest.fn().mockResolvedValue({
        query: 'What did I learn about Redis?',
        total: overrides?.searchResults?.length ?? 1,
        results: overrides?.searchResults ?? [
          {
            chunkId: 'chunk_1',
            observationId: 'obs_1',
            chunkIndex: 0,
            content: 'Redis is an in-memory data structure store.',
            similarity: 0.91,
            observation: {
              id: 'obs_1',
              filename: 'redis.txt',
              type: 'TEXT',
              mimeType: 'text/plain',
              createdAt: '2026-09-01T00:00:00.000Z',
              capturedAt: '2026-09-01T00:00:00.000Z',
              summary: null,
            },
          },
        ],
      }),
    };

    const ai = {
      name: 'test-ai',
      isConfigured: () => true,
      generateGroundedAnswer: jest.fn().mockResolvedValue({
        answer:
          overrides?.grounded?.answer ??
          'You learned that Redis is an in-memory data structure store.',
        citationRefs: overrides?.grounded?.citationRefs ?? [1],
        provider: 'test-ai',
        model: 'test',
      }),
    };

    const users = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue({
        id: 'user_a',
        clerkUserId: 'clerk_a',
      }),
    };

    const conversations = {
      ensureOwned: jest.fn(),
      createWithTitle: jest.fn().mockResolvedValue({
        id: 'conv_1',
        userId: 'user_a',
        title: 'What did I learn about Redis?',
      }),
      findIdempotentTurn: jest.fn().mockResolvedValue(null),
      persistUserMessage: jest.fn().mockResolvedValue({
        id: 'msg_user',
        conversationId: 'conv_1',
        role: 'USER',
        content: 'q',
        createdAt: new Date(),
      }),
      persistAssistantMessage: jest.fn().mockImplementation(async (params) => ({
        id: 'msg_assistant',
        conversationId: 'conv_1',
        role: 'ASSISTANT',
        content: params.content,
        status: params.status,
        citations: params.citations,
        insufficientEvidence: params.insufficientEvidence,
        createdAt: new Date(),
      })),
      loadRecentHistory: jest.fn().mockResolvedValue([]),
    };

    const service = new AskService(
      search as never,
      new RagContextBuilder(),
      conversations as never,
      users as never,
      ai as never,
      { relatedForClerkUser: jest.fn().mockResolvedValue([]) } as never,
    );

    return { service, search, ai, conversations, users };
  }

  it('rejects empty questions', async () => {
    const { service } = build();
    await expect(
      service.ask('clerk_a', { question: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reuses SearchService and does not call the LLM when retrieval is empty', async () => {
    const { service, search, ai, conversations } = build({
      searchResults: [],
    });
    const response = await service.ask('clerk_a', {
      question: 'What is the capital of France?',
    });

    expect(search.search).toHaveBeenCalledWith(
      'clerk_a',
      expect.objectContaining({
        query: 'What is the capital of France?',
      }),
      expect.any(Array),
    );
    expect(ai.generateGroundedAnswer).not.toHaveBeenCalled();
    expect(response.answer).toBe(NO_CONTEXT_ANSWER);
    expect(response.citations).toEqual([]);
    expect(response.insufficientEvidence).toBe(true);
    expect(response.conversationId).toBe('conv_1');
    expect(conversations.persistAssistantMessage).toHaveBeenCalled();
  });

  it('returns grounded answer with validated citations and persists turns', async () => {
    const { service, ai, conversations } = build();
    const response = await service.ask('clerk_a', {
      question: 'What is Redis?',
    });

    expect(ai.generateGroundedAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'What is Redis?',
        context: expect.arrayContaining([
          expect.objectContaining({ ref: 1, chunkId: 'chunk_1' }),
        ]),
      }),
    );
    expect(response.answer).toContain('Redis');
    expect(response.citations).toHaveLength(1);
    expect(response.conversationId).toBe('conv_1');
    expect(conversations.persistUserMessage).toHaveBeenCalled();
    expect(conversations.persistAssistantMessage).toHaveBeenCalled();
  });

  it('drops invented citation refs from the model', async () => {
    const { service } = build({
      grounded: {
        answer: 'Redis is useful for caching.',
        citationRefs: [1, 99],
      },
    });
    const response = await service.ask('clerk_a', {
      question: 'What about Redis?',
    });
    expect(response.citations).toHaveLength(1);
    expect(response.citations[0]?.chunkId).toBe('chunk_1');
  });

  it('expands follow-up retrieval query using prior user turns', async () => {
    const { service, search, conversations } = build();
    conversations.loadRecentHistory.mockResolvedValue([
      {
        id: 'old',
        role: 'USER',
        content: 'What did I use Redis for?',
        status: 'COMPLETED',
        createdAt: new Date(),
      },
    ]);

    await service.ask('clerk_a', {
      conversationId: 'conv_1',
      question: 'Why did I use it?',
    });

    expect(conversations.ensureOwned).toHaveBeenCalledWith('clerk_a', 'conv_1');
    expect(search.search).toHaveBeenCalledWith(
      'clerk_a',
      expect.objectContaining({
        query: expect.stringContaining('Why did I use it?'),
      }),
      expect.any(Array),
    );
    const query = search.search.mock.calls[0][1].query as string;
    expect(query).toContain('Redis');
  });

  it('keeps the selected memory primary and adds related evidence', async () => {
    const { search, ai, conversations, users } = build();
    const relatedHit = {
      chunkId: 'chunk_related',
      observationId: 'obs_related',
      chunkIndex: 0,
      content: 'A closely related Redis note.',
      similarity: 0.84,
      observation: {
        id: 'obs_related',
        filename: 'related.txt',
        type: 'TEXT',
        mimeType: 'text/plain',
        createdAt: '2026-09-02T00:00:00.000Z',
        capturedAt: '2026-09-02T00:00:00.000Z',
        summary: null,
      },
    };
    search.search
      .mockReset()
      .mockResolvedValueOnce({
        query: 'What did I say?',
        total: 1,
        results: [
          {
            chunkId: 'chunk_1',
            observationId: 'obs_1',
            chunkIndex: 0,
            content: 'Redis is an in-memory data structure store.',
            similarity: 0.91,
            observation: {
              id: 'obs_1',
              filename: 'redis.txt',
              type: 'TEXT',
              mimeType: 'text/plain',
              createdAt: '2026-09-01T00:00:00.000Z',
              capturedAt: '2026-09-01T00:00:00.000Z',
              summary: null,
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        query: 'What did I say?',
        total: 1,
        results: [relatedHit],
      });
    const observations = {
      relatedForClerkUser: jest.fn().mockResolvedValue([
        { observationId: 'obs_related' },
      ]),
    };
    const service = new AskService(
      search as never,
      new RagContextBuilder(),
      conversations as never,
      users as never,
      ai as never,
      observations as never,
    );

    const response = await service.ask('clerk_a', {
      question: 'What did I say in this memory?',
      observationId: 'obs_1',
    });

    expect(search.search).toHaveBeenNthCalledWith(
      1,
      'clerk_a',
      expect.objectContaining({
        filters: expect.objectContaining({ observationId: 'obs_1' }),
      }),
      expect.any(Array),
    );
    expect(search.search).toHaveBeenNthCalledWith(
      2,
      'clerk_a',
      expect.objectContaining({
        filters: expect.objectContaining({ excludeObservationId: 'obs_1' }),
      }),
      expect.any(Array),
    );
    expect(observations.relatedForClerkUser).toHaveBeenCalledWith(
      'clerk_a',
      'obs_1',
    );
    expect(ai.generateGroundedAnswer).toHaveBeenCalled();
    expect(response.insufficientEvidence).toBe(false);
  });

  it('returns a completed idempotent turn without calling the LLM', async () => {
    const { service, ai, conversations } = build();
    conversations.findIdempotentTurn.mockResolvedValue({
      userMessage: { id: 'msg_user', conversationId: 'conv_1' },
      assistantMessage: {
        id: 'msg_ok',
        content: 'Cached grounded answer.',
        status: 'COMPLETED',
        citations: [],
        insufficientEvidence: false,
      },
    });

    const response = await service.ask('clerk_a', {
      conversationId: 'conv_1',
      question: 'What is Redis?',
      clientRequestId: 'req_1',
    });

    expect(response.answer).toBe('Cached grounded answer.');
    expect(ai.generateGroundedAnswer).not.toHaveBeenCalled();
    expect(conversations.persistUserMessage).not.toHaveBeenCalled();
  });

  it('retries generation when the previous assistant turn failed', async () => {
    const { service, ai, conversations } = build();
    conversations.findIdempotentTurn.mockResolvedValue({
      userMessage: { id: 'msg_user', conversationId: 'conv_1' },
      assistantMessage: {
        id: 'msg_failed',
        content: 'Kairos could not answer right now. Try again.',
        status: 'FAILED',
        citations: [],
        insufficientEvidence: true,
      },
    });

    await service.ask('clerk_a', {
      conversationId: 'conv_1',
      question: 'What is Redis?',
      clientRequestId: 'req_retry',
    });

    expect(ai.generateGroundedAnswer).toHaveBeenCalled();
    expect(conversations.persistAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'COMPLETED',
        replaceId: 'msg_failed',
      }),
    );
  });
});
