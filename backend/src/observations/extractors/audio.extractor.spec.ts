import { ObservationType } from '@prisma/client';
import { AudioExtractor } from './audio.extractor';

describe('AudioExtractor', () => {
  it('supports audio observations', () => {
    const extractor = new AudioExtractor(async () => ({
      text: 'hello',
      provider: 'test',
      model: 'whisper-1',
    }));
    expect(extractor.supports(ObservationType.AUDIO, 'audio/mp4')).toBe(true);
    expect(extractor.supports(ObservationType.TEXT, 'text/plain')).toBe(false);
  });

  it('returns transcript text', async () => {
    const extractor = new AudioExtractor(async () => ({
      text: 'I finally understood random forests today.',
      provider: 'openai-compatible',
      model: 'whisper-1',
    }));
    const result = await extractor.extract(Buffer.from('audio'), 'audio/mp4');
    expect(result.text).toContain('random forests');
    expect(result.metadata.transcript).toContain('random forests');
  });

  it('fails on empty recordings and empty transcripts', async () => {
    const extractor = new AudioExtractor(async () => ({
      text: '   ',
      provider: 'test',
      model: 'whisper-1',
    }));
    await expect(
      extractor.extract(Buffer.alloc(0), 'audio/mp4'),
    ).rejects.toThrow(/empty/i);
    await expect(
      extractor.extract(Buffer.from('x'), 'audio/mp4'),
    ).rejects.toThrow(/no speech/i);
  });
});
