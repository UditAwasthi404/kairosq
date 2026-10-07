import { ObservationType } from '@prisma/client';
import { ImageExtractor } from './image.extractor';

describe('ImageExtractor', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  it('returns metadata-only when OCR is disabled', async () => {
    process.env.OCR_PROVIDER = 'none';
    const extractor = new ImageExtractor();
    const result = await extractor.extract(
      Buffer.from('fake-image'),
      'image/png',
    );
    expect(result.text).toBeNull();
    expect(result.metadata.ocrAvailable).toBe(false);
    expect(result.notes).toMatch(/OCR is not configured/i);
  });

  it('extracts text via OCR when configured', async () => {
    process.env.OCR_PROVIDER = 'gemini';
    process.env.OCR_API_KEY = 'test-key';
    process.env.OCR_MODEL = 'gemini-3.8-flash';

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Hello from the screenshot' }],
            },
          },
        ],
      }),
    } as Response);

    const extractor = new ImageExtractor();
    expect(extractor.supports(ObservationType.IMAGE, 'image/png')).toBe(true);

    const result = await extractor.extract(
      Buffer.from('fake-image-bytes'),
      'image/png',
    );

    expect(result.text).toBe('Hello from the screenshot');
    expect(result.metadata.ocrAvailable).toBe(true);
    expect(result.metadata.ocrProvider).toBe('gemini');
    expect(result.notes).toBeUndefined();
  });
});
