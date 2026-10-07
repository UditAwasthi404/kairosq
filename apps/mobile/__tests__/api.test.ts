import {
  ApiError,
  askKairos,
  addObservationsToProjectBulk,
  createNoteObservation,
  deleteObservation,
  fetchAuthMe,
  fetchProgression,
  fetchLeaderboard,
  updateProgression,
  buyStreakFreeze,
  addProgressionPeer,
  fetchObservation,
  isProcessingObservationStatus,
  isTerminalObservationStatus,
  fetchObservationsPage,
  observationStatusHeadline,
  observationStatusLabel,
  registerDevicePushToken,
  reprocessObservation,
  semanticSearch,
  updateObservation,
  uploadObservation,
} from '../lib/api';

describe('observations API client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uploads a file and returns observation data', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        data: {
          id: 'obs_1',
          filename: 'notes.txt',
          mimeType: 'text/plain',
          type: 'TEXT',
          status: 'PENDING',
          createdAt: '2026-09-12T00:00:00.000Z',
          updatedAt: '2026-09-12T00:00:00.000Z',
          capturedAt: '2026-09-12T00:00:00.000Z',
          extractedText: null,
          summary: null,
          processingError: null,
          sourceMetadata: null,
          metadata: {
            filename: 'notes.txt',
            mimeType: 'text/plain',
            fileSizeBytes: 12,
            pageCount: null,
            characterCount: null,
            wordCount: null,
            chunkCount: null,
          },
          topics: [],
          entities: [],
          chunkCount: 0,
        },
      }),
    }) as typeof fetch;

    await expect(
      uploadObservation({
        token: 'tok',
        uri: 'file:///tmp/notes.txt',
        name: 'notes.txt',
        mimeType: 'text/plain',
      }),
    ).resolves.toMatchObject({ id: 'obs_1', status: 'PENDING' });
  });

  it('maps API error envelopes', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: 'UNSUPPORTED_FILE', message: 'Unsupported file type.' },
      }),
    }) as typeof fetch;

    await expect(fetchObservation('tok', 'obs_x')).rejects.toMatchObject({
      status: 400,
      code: 'UNSUPPORTED_FILE',
      message: 'Unsupported file type.',
    } satisfies Partial<ApiError>);
  });

  it('keeps auth me working', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'user_123', authenticated: true }),
    }) as typeof fetch;

    await expect(fetchAuthMe('token')).resolves.toEqual({
      id: 'user_123',
      authenticated: true,
    });
  });

  it('maps processing status labels', () => {
    expect(observationStatusLabel('PENDING')).toBe('Saved');
    expect(observationStatusLabel('EXTRACTING')).toBe('Processing memory…');
    expect(observationStatusLabel('ANALYZING')).toBe('Processing memory…');
    expect(observationStatusLabel('EMBEDDING')).toBe('Processing memory…');
    expect(observationStatusLabel('COMPLETED')).toBe('Memory ready');
    expect(observationStatusLabel('FAILED')).toBe("Couldn't process");
  });

  it('reprocesses via existing retry endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        data: {
          id: 'obs_1',
          filename: 'notes.txt',
          mimeType: 'text/plain',
          type: 'TEXT',
          status: 'PENDING',
          stageLabel: 'Processing…',
          createdAt: '2026-09-12T00:00:00.000Z',
          updatedAt: '2026-09-12T00:00:00.000Z',
          capturedAt: '2026-09-12T00:00:00.000Z',
          processedAt: null,
          extractedText: null,
          summary: null,
          processingError: null,
          sourceMetadata: null,
          metadata: {
            filename: 'notes.txt',
            mimeType: 'text/plain',
            fileSizeBytes: 12,
            pageCount: null,
            characterCount: null,
            wordCount: null,
            chunkCount: null,
          },
          topics: [],
          entities: [],
          projects: [],
          chunkCount: 0,
        },
      }),
    }) as typeof fetch;

    const result = await reprocessObservation('tok', 'obs_1');
    expect(result.status).toBe('PENDING');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/observations\/obs_1\/reprocess$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('classifies terminal vs processing statuses for polling', () => {
    expect(isTerminalObservationStatus('COMPLETED')).toBe(true);
    expect(isTerminalObservationStatus('FAILED')).toBe(true);
    expect(isProcessingObservationStatus('EMBEDDING')).toBe(true);
    expect(isProcessingObservationStatus('COMPLETED')).toBe(false);
    expect(observationStatusHeadline('FAILED')).toBe("Couldn't process");
    expect(observationStatusHeadline('COMPLETED')).toBe('Ready');
    expect(observationStatusHeadline('CHUNKING')).toBe('Processing');
  });

  it('posts semantic search requests', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          query: 'Redis',
          total: 1,
          results: [
            {
              chunkId: 'c1',
              observationId: 'o1',
              chunkIndex: 0,
              content: 'Redis is fast',
              similarity: 0.9,
              observation: {
                id: 'o1',
                filename: 'redis.txt',
                type: 'TEXT',
                mimeType: 'text/plain',
                createdAt: '2026-09-01T00:00:00.000Z',
                capturedAt: '2026-09-01T00:00:00.000Z',
                summary: null,
              },
            },
          ],
        },
      }),
    }) as typeof fetch;

    const result = await semanticSearch({
      token: 'tok',
      query: 'Redis',
      limit: 5,
    });
    expect(result.total).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/search$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('posts ask Kairos requests', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          question: 'What is Redis?',
          answer: 'You learned that Redis is used for caching.',
          citations: [
            {
              observationId: 'o1',
              chunkId: 'c1',
              title: 'redis.txt',
              snippet: 'Redis is used for caching.',
              createdAt: '2026-09-01T00:00:00.000Z',
            },
          ],
          insufficientEvidence: false,
          conversationId: 'conv_1',
          userMessageId: 'u1',
          assistantMessageId: 'a1',
        },
      }),
    }) as typeof fetch;

    const result = await askKairos({
      token: 'tok',
      question: 'What is Redis?',
      limit: 6,
    });
    expect(result.answer).toContain('Redis');
    expect(result.conversationId).toBe('conv_1');
    expect(result.citations).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/ask$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('creates a note and deletes an observation via API client', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            id: 'obs_note',
            filename: 'hello.txt',
            mimeType: 'text/plain',
            type: 'TEXT',
            status: 'PENDING',
            createdAt: '2026-09-12T00:00:00.000Z',
            updatedAt: '2026-09-12T00:00:00.000Z',
            capturedAt: '2026-09-12T00:00:00.000Z',
            extractedText: null,
            summary: null,
            processingError: null,
            sourceMetadata: null,
            metadata: {
              filename: 'hello.txt',
              mimeType: 'text/plain',
              fileSizeBytes: 12,
              pageCount: null,
              characterCount: null,
              wordCount: null,
              chunkCount: null,
            },
            topics: [],
            entities: [],
            projects: [],
            chunkCount: 0,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      }) as typeof fetch;

    const note = await createNoteObservation({
      token: 'tok',
      text: 'Hello Kairos',
      title: 'Hello',
    });
    expect(note.id).toBe('obs_note');
    await expect(deleteObservation('tok', 'obs_note')).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/observations\/from-text$/),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/observations\/obs_note$/),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('patches an observation edit', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: 'obs_1',
          filename: 'Edited.txt',
          extractedText: 'New text',
          status: 'PENDING',
        },
      }),
    }) as typeof fetch;

    const updated = await updateObservation('tok', 'obs_1', {
      title: 'Edited',
      content: 'New text',
    });
    expect(updated.id).toBe('obs_1');
    expect(updated.extractedText).toBe('New text');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/observations\/obs_1$/),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('surfaces a failed observation edit', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: 'FORBIDDEN', message: 'Not allowed.' },
      }),
    }) as typeof fetch;

    await expect(
      updateObservation('tok', 'obs_other', { content: 'nope' }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('reads observation pages with a cursor', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ id: 'obs_2', filename: 'older.txt' }],
        nextCursor: null,
      }),
    }) as typeof fetch;

    const page = await fetchObservationsPage('tok', {
      cursor: 'abc',
      limit: 40,
    });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/cursor=abc/),
      expect.any(Object),
    );
  });

  it('sends source and date filters with semantic search', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { query: 'redis', total: 0, results: [] },
      }),
    }) as typeof fetch;

    await semanticSearch({
      token: 'tok',
      query: 'redis',
      filters: {
        source: 'VOICE',
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-24T23:59:59.999Z',
      },
    });
    const init = (global.fetch as jest.Mock).mock.calls[0][1] as {
      body: string;
    };
    expect(JSON.parse(init.body)).toMatchObject({
      query: 'redis',
      filters: {
        source: 'VOICE',
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-24T23:59:59.999Z',
      },
    });
  });

  it('registers an Expo push token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { id: 'tok_1', platform: 'ANDROID' },
      }),
    }) as typeof fetch;

    await expect(
      registerDevicePushToken({
        token: 'tok',
        expoPushToken: 'ExponentPushToken[abc]',
        platform: 'ANDROID',
      }),
    ).resolves.toEqual({ id: 'tok_1', platform: 'ANDROID' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/devices\/push-token$/),
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

describe('progression API client', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('uses the typed progression endpoints and payloads', async () => {
    const view = { xp: 4, level: 1, lastEvent: null };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: view }) }) as typeof fetch;
    await expect(fetchProgression('tok')).resolves.toEqual(view);
    expect(global.fetch).toHaveBeenLastCalledWith(expect.stringMatching(/\/progression$/), expect.objectContaining({ cache: 'no-store' }));

    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { scope: 'circle', visible: false, selfRank: null, rows: [] } }) }) as typeof fetch;
    await fetchLeaderboard({ token: 'tok', scope: 'circle' });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('scope=circle'), expect.anything());

    const request = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: view }) });
    global.fetch = request as unknown as typeof fetch;
    await updateProgression({ token: 'tok', leaderboardVisible: true, displayName: 'A' });
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ leaderboardVisible: true, displayName: 'A' });
    await buyStreakFreeze('tok');
    expect(request.mock.calls[1][0]).toMatch(/\/progression\/freeze$/);
    await addProgressionPeer({ token: 'tok', peerUserId: 'peer_12345678' });
    expect(JSON.parse(request.mock.calls[2][1].body)).toEqual({ peerUserId: 'peer_12345678' });
  });
});

describe('project bulk API', () => {
  it('posts selected observations to the project bulk endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { projectId: 'p/1', added: ['o1', 'o2'], alreadyPresent: [] } }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(addObservationsToProjectBulk({ token: 'tok', projectId: 'p/1', observationIds: ['o1', 'o2'] })).resolves.toEqual({ projectId: 'p/1', added: ['o1', 'o2'], alreadyPresent: [] });
    expect(fetchMock.mock.calls[0][0]).toContain('/projects/p%2F1/observations/bulk');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ observationIds: ['o1', 'o2'] });
  });
});
