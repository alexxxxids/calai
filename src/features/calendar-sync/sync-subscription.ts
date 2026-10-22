import 'server-only';

import dns from 'node:dns';
import net from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import { parseAndExpandIcal } from './parse-ical';
import { isPrivateHostname, isPrivateIpAddress } from './schemas';

export const MAX_FEED_SIZE_BYTES = 2_097_152;
export const MAX_REDIRECTS = 3;
export const FETCH_TIMEOUT_MS = 10_000;
export const SYNC_PAST_DAYS = 7;
export const SYNC_FUTURE_DAYS = 60;
export const MS_PER_DAY = 86_400_000;
export const MAX_ERROR_LENGTH = 200;

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

export interface SyncSubscriptionResult {
  readonly ok: boolean;
  readonly count?: number;
  readonly error?: string;
}

export interface SyncItemSummary {
  readonly id: string;
  readonly ok: boolean;
  readonly count?: number;
  readonly error?: string;
}

export interface SyncAllSummary {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly results: readonly SyncItemSummary[];
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

  const records = await dns.promises.lookup(cleanHost, { all: true });
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

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return '';
}

function isTimeoutError(error: unknown, msg: string): boolean {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return true;
  }
  const lower = msg.toLowerCase();
  return (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('abort') ||
    lower.includes('limit czasu')
  );
}

export function formatSyncError(error: unknown): string {
  const msg = extractErrorMessage(error);

  if (isTimeoutError(error, msg)) {
    return 'Przekroczono limit czasu połączenia (10 s)';
  }
  if (msg.includes('Rozmiar pliku kalendarza przekracza limit 2 MB')) {
    return 'Rozmiar pliku kalendarza przekracza limit 2 MB';
  }
  if (msg.includes('SSRF') || msg.includes('sieci prywatnej')) {
    return 'Zablokowano adres sieci prywatnej (SSRF)';
  }
  if (msg.startsWith('Błąd pobierania kalendarza (HTTP ')) {
    return msg.slice(0, MAX_ERROR_LENGTH);
  }

  const fallback = msg.trim() || 'Nieznany błąd synchronizacji';
  return fallback.slice(0, MAX_ERROR_LENGTH);
}

async function recordSubscriptionError(
  supabase: SupabaseClient<Database>,
  subscriptionId: string,
  formattedError: string,
  now: Date,
): Promise<void> {
  try {
    await supabase
      .from('calendar_subscriptions')
      .update({
        last_error: formattedError,
        last_synced_at: now.toISOString(),
      })
      .eq('id', subscriptionId);
  } catch {
    // Ignore error updating subscription to preserve root failure
  }
}

export async function syncSubscription(
  supabase: SupabaseClient<Database>,
  subscriptionId: string,
  now: Date,
): Promise<SyncSubscriptionResult> {
  try {
    const { data: sub, error: queryError } = await supabase
      .from('calendar_subscriptions')
      .select('id, user_id, name, url')
      .eq('id', subscriptionId)
      .maybeSingle();

    if (queryError) {
      throw queryError;
    }
    if (!sub) {
      return { ok: false, error: 'Nie znaleziono subskrypcji' };
    }

    const rangeStart = new Date(now.getTime() - SYNC_PAST_DAYS * MS_PER_DAY);
    const rangeEnd = new Date(now.getTime() + SYNC_FUTURE_DAYS * MS_PER_DAY);

    const icsText = await fetchIcalFeed(sub.url);
    const events = parseAndExpandIcal(icsText, {
      rangeStart,
      rangeEnd,
      fallbackTitle: sub.name,
    });

    const { data: count, error: rpcError } = await supabase.rpc(
      'replace_external_events',
      {
        p_subscription_id: sub.id,
        p_events: events as unknown as Json,
      },
    );

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    return { ok: true, count: count ?? 0 };
  } catch (err) {
    const formattedError = formatSyncError(err);
    await recordSubscriptionError(supabase, subscriptionId, formattedError, now);
    return { ok: false, error: formattedError };
  }
}

export async function syncAllSubscriptions(
  admin: SupabaseClient<Database>,
  now: Date,
): Promise<SyncAllSummary> {
  const { data: subs, error } = await admin
    .from('calendar_subscriptions')
    .select('id');

  if (error || !subs) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    };
  }

  const results: SyncItemSummary[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      const res = await syncSubscription(admin, sub.id, now);
      if (res.ok) {
        succeeded++;
        results.push({ id: sub.id, ok: true, count: res.count });
      } else {
        failed++;
        results.push({ id: sub.id, ok: false, error: res.error });
      }
    } catch (err) {
      failed++;
      results.push({ id: sub.id, ok: false, error: formatSyncError(err) });
    }
  }

  return {
    total: subs.length,
    succeeded,
    failed,
    results,
  };
}
