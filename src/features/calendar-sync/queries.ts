import 'server-only';

import type { ServerSupabase } from '@/lib/supabase/server';

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
