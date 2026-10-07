import { BadRequestException } from '@nestjs/common';
import * as dns from 'dns/promises';
import * as net from 'net';
import { isIP } from 'net';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
]);

export type FetchedUrlContent = {
  url: string;
  title: string;
  text: string;
  contentType: string;
};

export function assertPublicHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new BadRequestException({
      error: { code: 'INVALID_URL', message: 'Enter a valid http(s) URL.' },
    });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException({
      error: {
        code: 'INVALID_URL',
        message: 'Only http and https URLs are supported.',
      },
    });
  }

  if (parsed.username || parsed.password) {
    throw new BadRequestException({
      error: {
        code: 'INVALID_URL',
        message: 'URLs with credentials are not allowed.',
      },
    });
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new BadRequestException({
      error: { code: 'INVALID_URL', message: 'That URL cannot be fetched.' },
    });
  }

  if (isIP(hostname) && isPrivateOrLocalIp(hostname)) {
    throw new BadRequestException({
      error: { code: 'INVALID_URL', message: 'That URL cannot be fetched.' },
    });
  }

  return parsed;
}

export async function assertResolvesToPublicAddress(
  hostname: string,
): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateOrLocalIp(hostname)) {
      throw new BadRequestException({
        error: { code: 'INVALID_URL', message: 'That URL cannot be fetched.' },
      });
    }
    return;
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new BadRequestException({
      error: {
        code: 'URL_UNREACHABLE',
        message: 'Could not resolve that URL.',
      },
    });
  }

  if (records.length === 0) {
    throw new BadRequestException({
      error: {
        code: 'URL_UNREACHABLE',
        message: 'Could not resolve that URL.',
      },
    });
  }

  for (const record of records) {
    if (isPrivateOrLocalIp(record.address)) {
      throw new BadRequestException({
        error: { code: 'INVALID_URL', message: 'That URL cannot be fetched.' },
      });
    }
  }
}

export async function fetchUrlContent(
  rawUrl: string,
): Promise<FetchedUrlContent> {
  let current = assertPublicHttpUrl(rawUrl);
  await assertResolvesToPublicAddress(current.hostname);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'User-Agent': 'KairosUrlIngest/1.0',
        },
      });
    } catch {
      throw new BadRequestException({
        error: {
          code: 'URL_FETCH_FAILED',
          message: 'Could not fetch that URL.',
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new BadRequestException({
          error: {
            code: 'URL_FETCH_FAILED',
            message: 'Could not fetch that URL.',
          },
        });
      }
      current = assertPublicHttpUrl(new URL(location, current).toString());
      await assertResolvesToPublicAddress(current.hostname);
      continue;
    }

    if (!response.ok) {
      throw new BadRequestException({
        error: {
          code: 'URL_FETCH_FAILED',
          message: 'Could not fetch that URL.',
        },
      });
    }

    const contentType = (response.headers.get('content-type') || 'text/plain')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (
      !contentType.startsWith('text/') &&
      contentType !== 'application/xhtml+xml' &&
      contentType !== 'application/json'
    ) {
      throw new BadRequestException({
        error: {
          code: 'UNSUPPORTED_URL_CONTENT',
          message: 'That URL does not return readable text content.',
        },
      });
    }

    const buffer = await readResponseBodyCapped(response, MAX_BYTES);
    if (buffer.byteLength === 0) {
      throw new BadRequestException({
        error: {
          code: 'URL_EMPTY',
          message: 'That URL returned no content.',
        },
      });
    }

    const raw = buffer.toString('utf8');
    const title = extractTitle(raw, current) || current.hostname;
    const text =
      contentType.includes('html') || contentType === 'application/xhtml+xml'
        ? htmlToText(raw)
        : raw.trim();

    if (!text || text.length < 20) {
      throw new BadRequestException({
        error: {
          code: 'URL_EMPTY',
          message: 'Could not extract enough text from that URL.',
        },
      });
    }

    return {
      url: current.toString(),
      title: title.slice(0, 120),
      text: text.slice(0, MAX_BYTES),
      contentType,
    };
  }

  throw new BadRequestException({
    error: {
      code: 'URL_FETCH_FAILED',
      message: 'Too many redirects while fetching that URL.',
    },
  });
}

export function isPrivateOrLocalIp(ip: string): boolean {
  if (!net.isIP(ip)) return true;
  const normalized = ip.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    return isPrivateOrLocalIp(normalized.slice('::ffff:'.length));
  }
  if (ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }

  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    // Non-IPv4 public addresses (global unicast IPv6) allowed if not link-local/ULA above.
    return net.isIPv6(ip) ? false : true;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function extractTitle(html: string, url: URL): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (match?.[1]) {
    return decodeEntities(match[1]).replace(/\s+/g, ' ').trim();
  }
  return url.hostname;
}

function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const withBreaks = withoutScripts
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(withBreaks)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function readResponseBodyCapped(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    const fallback = Buffer.from(await response.arrayBuffer());
    if (fallback.byteLength > maxBytes) {
      throw new BadRequestException({
        error: {
          code: 'URL_TOO_LARGE',
          message: 'That page is too large to ingest.',
        },
      });
    }
    return fallback;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore cancel errors
      }
      throw new BadRequestException({
        error: {
          code: 'URL_TOO_LARGE',
          message: 'That page is too large to ingest.',
        },
      });
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}
