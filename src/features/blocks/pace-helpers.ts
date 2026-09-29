import 'server-only';

import { TYPE_PACE_MAX_SAMPLES, TYPE_PACE_SEED } from '@/domain/constants';
import { paceSample, taskPace, typePace } from '@/domain/pace';
import type { ServerSupabase } from '@/lib/supabase/server';

interface PaceBlockRow {
  readonly work_minutes: number;
  readonly actual_minutes: number | null;
  readonly closed_at: string | null;
}

function extractPaceSamples(rows: readonly PaceBlockRow[]): number[] {
  const samples: number[] = [];
  for (const row of rows) {
    if (row.actual_minutes !== null && row.work_minutes > 0 && row.actual_minutes > 0) {
      samples.push(paceSample(row.actual_minutes, row.work_minutes));
    }
  }
  return samples;
}

async function fetchTypePaceSamples(
  supabase: ServerSupabase,
  userId: string,
  typeId: string,
): Promise<number[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select('work_minutes, actual_minutes, closed_at, tasks!inner(type_id)')
    .eq('user_id', userId)
    .eq('status', 'done')
    .eq('tasks.type_id', typeId)
    .not('actual_minutes', 'is', null)
    .not('closed_at', 'is', null)
    .gt('work_minutes', 0)
    .gt('actual_minutes', 0)
    .order('closed_at', { ascending: false })
    .limit(TYPE_PACE_MAX_SAMPLES);

  if (error) {
    throw new Error(`Błąd pobierania bloków typu zadania: ${error.message}`);
  }

  const rows = (data ?? []).slice().reverse();
  return extractPaceSamples(rows as unknown as readonly PaceBlockRow[]);
}

async function fetchTaskPaceSamples(
  supabase: ServerSupabase,
  userId: string,
  taskId: string,
): Promise<number[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select('work_minutes, actual_minutes, closed_at')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .eq('status', 'done')
    .not('actual_minutes', 'is', null)
    .not('closed_at', 'is', null)
    .gt('work_minutes', 0)
    .gt('actual_minutes', 0)
    .order('closed_at', { ascending: true });

  if (error) {
    throw new Error(`Błąd pobierania bloków zadania: ${error.message}`);
  }

  return extractPaceSamples((data ?? []) as unknown as readonly PaceBlockRow[]);
}

export async function calculateTaskPaceForTask(
  supabase: ServerSupabase,
  userId: string,
  taskId: string,
  typeId: string,
): Promise<number> {
  const [typeSamples, taskSamples] = await Promise.all([
    fetchTypePaceSamples(supabase, userId, typeId),
    fetchTaskPaceSamples(supabase, userId, taskId),
  ]);

  const calculatedTypePace = typeSamples.length > 0 ? typePace(typeSamples) : TYPE_PACE_SEED;
  return taskPace(taskSamples, calculatedTypePace);
}
