import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import { fetchIcalFeed } from './fetch-feed';
import { parseAndExpandIcal } from './parse-ical';

export {
  MAX_FEED_SIZE_BYTES,
  MAX_REDIRECTS,
  FETCH_TIMEOUT_MS,
  DNS_TIMEOUT_MS,
  validateHostNotPrivate,
  fetchIcalFeed,
} from './fetch-feed';

export const SYNC_PAST_DAYS = 7;
export const SYNC_FUTURE_DAYS = 60;
export const MS_PER_DAY = 86_400_000;
export const MAX_ERROR_LENGTH = 200;

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

  if (msg.includes('Przekroczono limit czasu DNS')) {
    return 'Przekroczono limit czasu DNS (3 s)';
  }
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
): Promise<void> {
  try {
    await supabase
      .from('calendar_subscriptions')
      .update({
        last_error: formattedError,
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
    await recordSubscriptionError(supabase, subscriptionId, formattedError);
    return { ok: false, error: formattedError };
  }
}

export async function syncAllSubscriptions(
  admin: SupabaseClient<Database>,
  now: Date,
): Promise<SyncAllSummary> {
  const { data: subs, error } = await admin
    .from('calendar_subscriptions')
    .select('id')
    .order('last_synced_at', { ascending: true, nullsFirst: true });

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
