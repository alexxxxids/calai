import 'server-only';

import type { ServerSupabase } from '@/lib/supabase/server';

export interface CalendarSubscriptionWithDetails {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly typeId: string;
  readonly typeName: string;
  readonly typeColor: string;
  readonly lastSyncedAt: string | null;
  readonly lastError: string | null;
  readonly createdAt: string;
}

/**
 * Retrieves the current user's iCal feed token from the database.
 * Returns null if the user has not generated a feed token yet.
 * Throws if a database error occurs to avoid masking errors.
 */
export async function getCalendarFeedToken(
  supabase: ServerSupabase,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('calendar_feeds')
    .select('token')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[getCalendarFeedToken] Database error querying feed token:', error);
    throw new Error(`Nie udało się pobrać tokenu kalendarza: ${error.message}`);
  }

  return data?.token ?? null;
}

/**
 * Lists all iCal calendar subscriptions for the given user, joined with task type details.
 */
export async function listCalendarSubscriptions(
  supabase: ServerSupabase,
  userId: string,
): Promise<CalendarSubscriptionWithDetails[]> {
  const { data, error } = await supabase
    .from('calendar_subscriptions')
    .select(
      'id, name, url, type_id, last_synced_at, last_error, created_at, task_types(name, color)',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[listCalendarSubscriptions] Database error querying subscriptions:', error);
    throw new Error(`Nie udało się pobrać subskrypcji kalendarza: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  return data.map((row) => {
    const taskType = Array.isArray(row.task_types) ? row.task_types[0] : row.task_types;
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      typeId: row.type_id,
      typeName: taskType?.name ?? '',
      typeColor: taskType?.color ?? '#888888',
      lastSyncedAt: row.last_synced_at,
      lastError: row.last_error,
      createdAt: row.created_at,
    };
  });
}
