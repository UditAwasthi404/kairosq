import { HttpStatus } from '@nestjs/common';
import { toAskHttpException } from './ask-errors';

describe('toAskHttpException', () => {
  it('maps embedding failures to SEARCH_UNAVAILABLE', () => {
    const err = toAskHttpException(
      new Error('Embedding request failed with status 500'),
    );
    expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect((err.getResponse() as { error: { code: string } }).error.code).toBe(
      'SEARCH_UNAVAILABLE',
    );
  });

  it('maps AI upstream status failures', () => {
    const err = toAskHttpException(
      new Error('AI request failed with status 500'),
    );
    expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect((err.getResponse() as { error: { code: string } }).error.code).toBe(
      'AI_UPSTREAM_ERROR',
    );
  });

  it('maps rate limits', () => {
    const err = toAskHttpException(new Error('AI rate limit exceeded'));
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });
});
