import 'server-only';

import type { ServerSupabase } from '@/lib/supabase/server';

/**
 * Checks if the user has at least one active push notification subscription.
 */
export async function hasPushSubscription(
  supabase: ServerSupabase,
  userId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Błąd sprawdzania subskrypcji push: ${error.message}`);
  }

  return (count ?? 0) > 0;
}
