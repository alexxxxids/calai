import 'server-only';
import type { ServerSupabase } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

/**
 * Loads the current user's profile row.
 * Returns null if the profile does not exist yet.
 */
export async function getProfile(
  supabase: ServerSupabase,
  userId: string
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
