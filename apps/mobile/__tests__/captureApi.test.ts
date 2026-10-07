import {
  createCapture,
  uploadCapture,
  fetchDashboard,
  fetchPredictions,
  fetchTodayInsight,
} from '../lib/api';

describe('canonical capture API client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts normalized capture payloads', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'obs_1',
          type: 'TEXT',
          source: 'QUICK_CAPTURE',
          sourceLabel: 'Quick capture',
          status: 'PENDING',
        },
      }),
    }) as unknown as typeof fetch;

    const result = await createCapture('tok', {
      content: 'A thought',
      source: 'QUICK_CAPTURE',
    });
    expect(result.id).toBe('obs_1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/capture$/),
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string,
    );
    expect(body.source).toBe('QUICK_CAPTURE');
    expect(body.content).toBe('A thought');
  });

  it('uploads voice files to the capture upload endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 'obs_voice', type: 'AUDIO', source: 'VOICE', status: 'PENDING' },
      }),
    }) as unknown as typeof fetch;

    const result = await uploadCapture({
      token: 'tok',
      uri: 'file://voice.m4a',
      name: 'voice.m4a',
      mimeType: 'audio/mp4',
      source: 'VOICE',
    });
    expect(result.source).toBe('VOICE');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/capture\/upload$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('loads today insight', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          title: "Today's insight",
          body: 'Backend work this week.',
          generatedAt: '2026-09-23T00:00:00.000Z',
          observationCount: 2,
          empty: false,
        },
      }),
    }) as unknown as typeof fetch;

    const insight = await fetchTodayInsight('tok');
    expect(insight.body).toMatch(/Backend work/);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/insights\/today$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('loads dashboard and predictions', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            greeting: 'Good morning',
            daySummary: '1 memory · 0 topics · 0 projects',
            todayCount: 1,
            weekCount: 3,
            todayTopicCount: 0,
            todayProjectCount: 0,
            processingCount: 0,
            completedCount: 3,
            totalCount: 3,
            insight: {
              title: 'Something I noticed',
              body: 'Backend work.',
              generatedAt: '2026-09-23T00:00:00.000Z',
              observationCount: 3,
              empty: false,
              evidence: [],
              why: 'Based on 3 memories',
              maturity: 'pattern',
            },
            sources: [{ source: 'SHARE', label: 'Share', count: 2 }],
            topics: [],
            recent: [],
            activity: [{ date: '2026-09-23', label: 'W', count: 1 }],
            streak: { current: 1, longest: 2, capturedToday: true },
            habit: {
              dailyGoal: 1,
              todayProgress: 1,
              weekGoalDays: 5,
              weekDaysCompleted: 1,
              week: [{ date: '2026-09-23', label: 'W', done: true, count: 1 }],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            generatedAt: '2026-09-23T00:00:00.000Z',
            empty: false,
            items: [{
              kind: 'next',
              title: 'Likely next',
              body: 'Stay on Kafka.',
              why: '6 mentions · 7 days',
              maturity: 'pattern',
              evidence: [],
            }],
          },
        }),
      }) as unknown as typeof fetch;

    const dashboard = await fetchDashboard('tok');
    expect(dashboard.totalCount).toBe(3);
    expect(dashboard.streak.current).toBe(1);
    expect(dashboard.habit.weekDaysCompleted).toBe(1);
    const predictions = await fetchPredictions('tok');
    expect(predictions.items[0].kind).toBe('next');
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/insights\/dashboard$/),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/insights\/predictions$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('fills missing dashboard rhythm fields', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          greeting: 'Good evening',
          daySummary: '0 memories',
          todayCount: 0,
          weekCount: 0,
          todayTopicCount: 0,
          todayProjectCount: 0,
          processingCount: 0,
          completedCount: 0,
          totalCount: 0,
          insight: {
            title: 'Something I noticed',
            body: 'Capture something today.',
            generatedAt: '2026-09-23T00:00:00.000Z',
            observationCount: 0,
            empty: true,
            evidence: [],
            why: 'No completed memories',
            maturity: 'single',
          },
          sources: [],
          topics: [],
          recent: [],
        },
      }),
    }) as unknown as typeof fetch;

    const dashboard = await fetchDashboard('tok');
    expect(dashboard.activity).toEqual([]);
    expect(dashboard.heatmap).toEqual([]);
    expect(dashboard.streak).toEqual({
      current: 0,
      longest: 0,
      capturedToday: false,
    });
    expect(dashboard.habit.dailyGoal).toBe(1);
    expect(dashboard.habit.week).toHaveLength(7);
  });
});
