import { HttpException, HttpStatus } from '@nestjs/common';

/** Map internal Ask/Search AI failures to safe client-facing HttpExceptions. */
export function toAskHttpException(error: unknown): HttpException {
  if (error instanceof HttpException) {
    return error;
  }

  const message = error instanceof Error ? error.message : 'Ask failed';

  if (/not configured/i.test(message)) {
    return new HttpException(
      {
        error: {
          code: 'ASK_UNAVAILABLE',
          message: 'Ask Kairos is temporarily unavailable.',
        },
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  if (/rate limit|429/i.test(message)) {
    return new HttpException(
      {
        error: {
          code: 'AI_RATE_LIMITED',
          message: 'Kairos is busy right now. Try again in a moment.',
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  if (/timed out|timeout|AbortError/i.test(message)) {
    return new HttpException(
      {
        error: {
          code: 'AI_TIMEOUT',
          message: 'Kairos took too long to answer. Try again.',
        },
      },
      HttpStatus.GATEWAY_TIMEOUT,
    );
  }

  if (
    /INVALID_AI_OUTPUT|grounded answer|answer must|empty content|non-object JSON|JSON/i.test(
      message,
    )
  ) {
    return new HttpException(
      {
        error: {
          code: 'ASK_INVALID_RESPONSE',
          message: 'Kairos could not produce a valid answer. Try again.',
        },
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  if (
    /AI request failed with status 401|unauthorized|invalid api key|incorrect api key/i.test(
      message,
    )
  ) {
    return new HttpException(
      {
        error: {
          code: 'ASK_UNAVAILABLE',
          message: 'Ask Kairos is temporarily unavailable.',
        },
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  if (/embedding/i.test(message)) {
    return new HttpException(
      {
        error: {
          code: 'SEARCH_UNAVAILABLE',
          message:
            'Could not search your memories right now. Check embedding configuration and try again.',
        },
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  if (/AI request failed with status/i.test(message)) {
    return new HttpException(
      {
        error: {
          code: 'AI_UPSTREAM_ERROR',
          message: 'Kairos could not reach the AI provider. Try again shortly.',
        },
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  return new HttpException(
    {
      error: {
        code: 'ASK_FAILED',
        message: 'Could not answer from your memories. Try again.',
      },
    },
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
