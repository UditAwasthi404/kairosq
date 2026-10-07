import { MAX_ASK_QUESTION_LENGTH, validateAskRequest } from './ask.validation';

describe('validateAskRequest', () => {
  it('rejects empty question', () => {
    expect(() => validateAskRequest({ question: '   ' })).toThrow();
  });

  it('rejects non-string question', () => {
    expect(() => validateAskRequest({ question: 12 })).toThrow();
  });

  it('rejects oversized question', () => {
    expect(() =>
      validateAskRequest({
        question: 'a'.repeat(MAX_ASK_QUESTION_LENGTH + 1),
      }),
    ).toThrow();
  });

  it('accepts query alias and valid filters', () => {
    const result = validateAskRequest({
      query: '  What did I learn about Redis? ',
      limit: 4,
      filters: { observationType: 'TEXT' },
    });
    expect(result.question).toBe('What did I learn about Redis?');
    expect(result.limit).toBe(4);
    expect(result.filters.observationType).toBe('TEXT');
  });

  it('rejects invalid limit', () => {
    expect(() => validateAskRequest({ question: 'hi', limit: 0 })).toThrow();
    expect(() => validateAskRequest({ question: 'hi', limit: 99 })).toThrow();
  });
});
