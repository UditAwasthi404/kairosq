import { OpenAICompatibleProvider } from './openai-compatible.provider';

describe('OpenAICompatibleProvider.transcribeAudio', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.AI_API_KEY;
    delete process.env.TRANSCRIPTION_MODEL;
  });

  it('posts audio to /audio/transcriptions', async () => {
    process.env.AI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        text: 'I finally understood random forests today.',
      }),
    });

    const provider = new OpenAICompatibleProvider();
    const result = await provider.transcribeAudio(
      Buffer.from('fake-audio'),
      'audio/mp4',
    );

    expect(result.text).toMatch(/random forests/);
    expect(result.model).toBe('whisper-1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/audio\/transcriptions$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fails when the provider is not configured', async () => {
    const provider = new OpenAICompatibleProvider();
    await expect(
      provider.transcribeAudio(Buffer.from('x'), 'audio/mp4'),
    ).rejects.toThrow(/not configured/i);
  });
});
