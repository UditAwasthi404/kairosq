import type { ApiErrorPayload } from '@/types/api';

const READ_TIMEOUT_MS = 15_000;
const WRITE_TIMEOUT_MS = 90_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type ApiRequestInit = Omit<RequestInit, 'body'> & {
  /** Clerk session token. Omit for a request without Authorization. */
  token?: string | null;
  /** JSON body. Sets Content-Type and stringifies the value. */
  json?: unknown;
};

export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!url) {
    throw new ApiError(
      'Set NEXT_PUBLIC_API_URL to the Kairos API base URL.',
      0,
      'CONFIG',
    );
  }
  return url.replace(/\/+$/, '');
}

function timeoutFor(method: string): number {
  return method === 'GET' || method === 'HEAD' ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS;
}

function messageFrom(body: ApiErrorPayload, status: number): string {
  if (body.error?.message) return body.error.message;
  if (typeof body.message === 'string' && body.message) return body.message;
  if (Array.isArray(body.message) && body.message.length > 0) {
    return body.message.join(', ');
  }
  return `Request failed with status ${status}`;
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorPayload;
    return new ApiError(messageFrom(body, response.status), response.status, body.error?.code);
  } catch {
    return new ApiError(`Request failed with status ${response.status}`, response.status);
  }
}

/**
 * Authenticated JSON fetch against NEXT_PUBLIC_API_URL.
 * No resource endpoints live here yet — callers pass a path such as `/auth/me`.
 */
export async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  const url = path.startsWith('http')
    ? path
    : `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const { token, json, ...rest } = init;
  const method = (rest.method ?? (json !== undefined ? 'POST' : 'GET')).toUpperCase();
  const headers = new Headers(rest.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  headers.set('Cache-Control', 'no-cache');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutFor(method));

  try {
    const response = await fetch(url, {
      ...rest,
      method,
      headers,
      body,
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) throw await parseError(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      throw new ApiError('Kairos is taking too long to respond.', 0, 'TIMEOUT');
    }
    throw new ApiError('No connection to Kairos.', 0, 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
}
