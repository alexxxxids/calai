import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export interface StarterTypeDefinition {
  readonly name: string;
  readonly color: string;
  readonly energy: number;
  readonly is_rest?: boolean;
}

/**
 * Starter task types created for new users according to FR-12:
 * Nauka (3), Szkoła (2), Programowanie (3), Sprzątanie (1), Sport (1)
 * and system type Odpoczynek (0, is_rest).
 */
export const STARTER_TYPES: readonly StarterTypeDefinition[] = [
  { name: 'Nauka', color: '#3b82f6', energy: 3 },
  { name: 'Szkoła', color: '#f59e0b', energy: 2 },
  { name: 'Programowanie', color: '#10b981', energy: 3 },
  { name: 'Sprzątanie', color: '#8b5cf6', energy: 1 },
  { name: 'Sport', color: '#ef4444', energy: 1 },
  { name: 'Odpoczynek', color: '#6b7280', energy: 0, is_rest: true },
] as const;

/**
 * Ensures starter task types exist for the given user.
 * If the user already has any task types, does nothing.
 * Gracefully handles race conditions if types already exist (code 23505).
 */
export async function ensureStarterTypes(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { count, error: countError } = await supabase
    .from('task_types')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    throw countError;
  }

  if (count && count > 0) {
    return;
  }

  const rows = STARTER_TYPES.map((t) => ({
    user_id: userId,
    name: t.name,
    color: t.color,
    energy: t.energy,
    is_rest: t.is_rest ?? false,
    is_one_off: false,
  }));

  const { error: insertError } = await supabase.from('task_types').insert(rows);

  if (insertError) {
    // 23505 is PostgreSQL unique_violation code
    if (insertError.code === '23505') {
      return;
    }
    throw insertError;
  }
}
