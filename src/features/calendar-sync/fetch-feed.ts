import 'server-only';

import dns from 'node:dns';
import net from 'node:net';
import { isPrivateHostname, isPrivateIpAddress } from './schemas';

export const MAX_FEED_SIZE_BYTES = 2_097_152;
export const MAX_REDIRECTS = 3;
export const FETCH_TIMEOUT_MS = 10_000;
export const DNS_TIMEOUT_MS = 3000;

const HTTP_MOVED_PERMANENTLY = 301;
const HTTP_FOUND = 302;
const HTTP_TEMPORARY_REDIRECT = 307;
const HTTP_PERMANENT_REDIRECT = 308;
const REDIRECT_STATUSES = [
  HTTP_MOVED_PERMANENTLY,
  HTTP_FOUND,
  HTTP_TEMPORARY_REDIRECT,
  HTTP_PERMANENT_REDIRECT,
] as const;

const RADIX_DECIMAL = 10;

async function lookupWithTimeout(
  hostname: string,
  timeoutMs: number = DNS_TIMEOUT_MS,
): Promise<dns.LookupAddress[]> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Przekroczono limit czasu DNS (3 s)'));
      }, timeoutMs);
    });

    const lookupPromise = dns.promises.lookup(hostname, { all: true });
    return await Promise.race([lookupPromise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function validateHostNotPrivate(hostname: string): Promise<void> {
  const cleanHost = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (isPrivateHostname(cleanHost)) {
    throw new Error('Zablokowano adres sieci prywatnej (SSRF)');
  }

  if (net.isIP(cleanHost)) {
    if (isPrivateIpAddress(cleanHost)) {
      throw new Error('Zablokowano adres sieci prywatnej (SSRF)');
    }
    return;
  }

  const records = await lookupWithTimeout(cleanHost, DNS_TIMEOUT_MS);
  for (const rec of records) {
    if (isPrivateIpAddress(rec.address)) {
      throw new Error('Zablokowano adres sieci prywatnej (SSRF)');
    }
  }
}

async function cancelReaderSafe(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // Ignore cancel error
  }
}

async function readResponseBody(response: Response): Promise<string> {
  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > MAX_FEED_SIZE_BYTES) {
          await cancelReaderSafe(reader);
          throw new Error('Rozmiar pliku kalendarza przekracza limit 2 MB');
        }
        chunks.push(value);
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore release lock error on closed/cancelled stream
    }
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(combined);
}

async function fetchSingleAttempt(url: string): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('Wymagany protokół HTTPS');
  }

  await validateHostNotPrivate(parsed.hostname);

  return fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'manual',
    headers: {
      Accept: 'text/calendar, text/plain, */*',
    },
  });
}

function resolveRedirectUrl(response: Response, currentUrl: string, count: number): string {
  if (count > MAX_REDIRECTS) {
    throw new Error('Zbyt wiele przekierowań');
  }
  const location = response.headers.get('Location');
  if (!location) {
    throw new Error(`Błąd pobierania kalendarza (HTTP ${response.status})`);
  }
  return new URL(location, currentUrl).toString();
}

function checkContentLengthHeader(response: Response): void {
  const header = response.headers.get('content-length');
  if (!header) {
    return;
  }
  const parsed = parseInt(header, RADIX_DECIMAL);
  if (!Number.isNaN(parsed) && parsed > MAX_FEED_SIZE_BYTES) {
    throw new Error('Rozmiar pliku kalendarza przekracza limit 2 MB');
  }
}

export async function fetchIcalFeed(initialUrl: string): Promise<string> {
  let currentUrl = initialUrl;
  let redirectCount = 0;

  while (true) {
    const response = await fetchSingleAttempt(currentUrl);

    if (REDIRECT_STATUSES.includes(response.status as (typeof REDIRECT_STATUSES)[number])) {
      await response.body?.cancel().catch(() => {});
      redirectCount++;
      currentUrl = resolveRedirectUrl(response, currentUrl, redirectCount);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Błąd pobierania kalendarza (HTTP ${response.status})`);
    }

    checkContentLengthHeader(response);
    return await readResponseBody(response);
  }
}
