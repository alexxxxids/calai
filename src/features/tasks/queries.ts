import 'server-only';

import type { ServerSupabase } from '@/lib/supabase/server';

import {
  calculateTypePaces,
  filterAndSortBacklog,
  type RawBacklogTask,
} from './backlog-helpers';
import type { BacklogTaskItem, TaskWithDetails } from './types';

interface RawTaskWithDetails {
  readonly id: string;
  readonly user_id: string;
  readonly type_id: string;
  readonly notes: string | null;
  readonly priority: number;
  readonly fixation: 'flexible' | 'hard';
  readonly estimate_minutes: number | null;
  readonly session_minutes: number | null;
  readonly deadline: string | null;
  readonly status: 'active' | 'done' | 'cancelled';
  readonly completed_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly task_types: {
    readonly name: string;
    readonly color: string;
    readonly energy: number;
    readonly is_one_off: boolean;
    readonly is_rest: boolean;
  };
}

function mapTaskWithDetails(data: RawTaskWithDetails): TaskWithDetails {
  const tt = data.task_types;
  return {
    id: data.id,
    userId: data.user_id,
    typeId: data.type_id,
    typeName: tt.name,
    typeColor: tt.color,
    typeEnergy: tt.energy,
    isOneOff: tt.is_one_off,
    isRest: tt.is_rest,
    priority: data.priority as TaskWithDetails['priority'],
    fixation: data.fixation,
    notes: data.notes,
    estimateMinutes: data.estimate_minutes,
    sessionMinutes: data.session_minutes,
    deadline: data.deadline,
    status: data.status,
    completedAt: data.completed_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

async function fetchBacklogData(supabase: ServerSupabase, userId: string, nowIso: string) {
  return Promise.all([
    supabase
      .from('tasks')
      .select(`
        id,
        type_id,
        notes,
        priority,
        fixation,
        estimate_minutes,
        session_minutes,
        deadline,
        created_at,
        task_types!inner (
          id,
          name,
          color,
          energy,
          is_one_off
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase
      .from('blocks')
      .select('task_id')
      .eq('user_id', userId)
      .eq('status', 'planned')
      .gt('ends_at', nowIso),
    supabase
      .from('blocks')
      .select('task_id, work_minutes, actual_minutes, closed_at')
      .eq('user_id', userId)
      .eq('status', 'done')
      .not('task_id', 'is', null)
      .not('actual_minutes', 'is', null)
      .not('closed_at', 'is', null)
      .gt('work_minutes', 0)
      .gt('actual_minutes', 0),
    supabase.from('tasks').select('id, type_id').eq('user_id', userId),
  ]);
}

interface QueryResultLike {
  readonly error: { readonly message: string } | null;
}

function checkQueryErrors(results: readonly QueryResultLike[]): void {
  for (const res of results) {
    if (res.error) {
      throw new Error(`Błąd pobierania danych backlogu: ${res.error.message}`);
    }
  }
}

function extractScheduledTaskIds(
  blocks: readonly { readonly task_id: string | null }[],
): Set<string> {
  const ids = new Set<string>();
  for (const b of blocks) {
    if (b.task_id) {
      ids.add(b.task_id);
    }
  }
  return ids;
}

export async function listBacklog(
  supabase: ServerSupabase,
  userId: string,
  now?: Date,
): Promise<BacklogTaskItem[]> {
  const nowIso = (now ?? new Date()).toISOString();
  const [tasksRes, futureBlocksRes, doneBlocksRes, allTasksRes] = await fetchBacklogData(
    supabase,
    userId,
    nowIso,
  );

  checkQueryErrors([tasksRes, futureBlocksRes, doneBlocksRes, allTasksRes]);

  const scheduledTaskIds = extractScheduledTaskIds(futureBlocksRes.data ?? []);
  const typePaces = calculateTypePaces(doneBlocksRes.data ?? [], allTasksRes.data ?? []);

  return filterAndSortBacklog(
    (tasksRes.data ?? []) as unknown as readonly RawBacklogTask[],
    scheduledTaskIds,
    typePaces,
  );
}

export async function getTaskById(
  supabase: ServerSupabase,
  userId: string,
  taskId: string,
): Promise<TaskWithDetails | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id,
      user_id,
      type_id,
      notes,
      priority,
      fixation,
      estimate_minutes,
      session_minutes,
      deadline,
      status,
      completed_at,
      created_at,
      updated_at,
      task_types!inner (
        name,
        color,
        energy,
        is_one_off,
        is_rest
      )
    `)
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapTaskWithDetails(data as unknown as RawTaskWithDetails);
}
