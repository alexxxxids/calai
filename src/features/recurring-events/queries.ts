import 'server-only';

import type { ServerSupabase } from '@/lib/supabase/server';

import type { RecurringEventTypeRelation, RecurringEventWithRelations } from './types';

interface RawRecurringEventRow {
  readonly id: string;
  readonly title: string;
  readonly type_id: string;
  readonly weekday: number;
  readonly start_time: string;
  readonly end_time: string;
  readonly valid_from: string;
  readonly valid_until: string | null;
  readonly task_types: RecurringEventTypeRelation | RecurringEventTypeRelation[] | null;
}

function mapRecurringEventRow(row: RawRecurringEventRow): RecurringEventWithRelations {
  const taskType = Array.isArray(row.task_types)
    ? (row.task_types[0] ?? null)
    : (row.task_types ?? null);

  return {
    id: row.id,
    title: row.title,
    type_id: row.type_id,
    weekday: row.weekday,
    start_time: row.start_time,
    end_time: row.end_time,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    task_types: taskType,
  };
}

export async function listRecurringEvents(
  supabase: ServerSupabase,
  userId: string,
): Promise<RecurringEventWithRelations[]> {
  const { data, error } = await supabase
    .from('recurring_events')
    .select(`
      id,
      title,
      type_id,
      weekday,
      start_time,
      end_time,
      valid_from,
      valid_until,
      task_types (
        id,
        name,
        color,
        energy
      )
    `)
    .eq('user_id', userId)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    throw new Error('Nie udało się pobrać powtarzających się wydarzeń');
  }

  const rows = (data ?? []) as unknown as readonly RawRecurringEventRow[];
  return rows.map(mapRecurringEventRow);
}
