import 'server-only';
import type { ServerSupabase } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

export type TaskTypeRow = Database['public']['Tables']['task_types']['Row'];

/**
 * Lists active task types for the given user (archived_at is null).
 * Returns rest type first, followed by types ordered by creation time.
 */
export async function listTaskTypes(
  supabase: ServerSupabase,
  userId: string
): Promise<TaskTypeRow[]> {
  const { data, error } = await supabase
    .from('task_types')
    .select('*')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('is_rest', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}
