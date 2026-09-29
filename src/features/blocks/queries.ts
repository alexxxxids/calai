import 'server-only';

import { MS_PER_DAY } from '@/domain/constants';
import type { ServerSupabase } from '@/lib/supabase/server';

import type { BlockItem, UnclosedBlockItem } from './types';

const UNCLOSED_BLOCKS_WINDOW_DAYS = 14;
const UNCLOSED_BLOCKS_WINDOW_MS = UNCLOSED_BLOCKS_WINDOW_DAYS * MS_PER_DAY;
const DEFAULT_TYPE_NAME = 'Zadanie';
const DEFAULT_TYPE_COLOR = '#94a3b8';
const DEFAULT_TYPE_ENERGY = 0;

interface RawTaskType {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly energy: number;
}

interface RawTask {
  readonly id: string;
  readonly notes: string | null;
  readonly priority: number;
  readonly task_types: RawTaskType | null;
}

interface RawBlockRow {
  readonly id: string;
  readonly task_id: string | null;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly work_minutes: number;
  readonly tasks: RawTask | null;
}

function mapUnclosedBlock(row: RawBlockRow): UnclosedBlockItem {
  const task = row.tasks;
  const taskType = task?.task_types;

  return {
    id: row.id,
    taskId: row.task_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    workMinutes: row.work_minutes,
    typeName: taskType?.name ?? DEFAULT_TYPE_NAME,
    typeColor: taskType?.color ?? DEFAULT_TYPE_COLOR,
    typeEnergy: taskType?.energy ?? DEFAULT_TYPE_ENERGY,
    notes: task?.notes ?? null,
  };
}

export async function listUnclosedBlocks(
  supabase: ServerSupabase,
  userId: string,
  now?: Date,
): Promise<UnclosedBlockItem[]> {
  const nowDate = now ?? new Date();
  const nowIso = nowDate.toISOString();
  const cutoffIso = new Date(nowDate.getTime() - UNCLOSED_BLOCKS_WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from('blocks')
    .select(`
      id,
      task_id,
      starts_at,
      ends_at,
      work_minutes,
      tasks (
        id,
        notes,
        priority,
        task_types (
          id,
          name,
          color,
          energy
        )
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'planned')
    .lt('ends_at', nowIso)
    .gte('ends_at', cutoffIso)
    .order('starts_at', { ascending: true });

  if (error) {
    throw new Error(`Błąd pobierania niezamkniętych bloków: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as readonly RawBlockRow[];
  return rows.map(mapUnclosedBlock);
}

export async function getBlockById(
  supabase: ServerSupabase,
  userId: string,
  blockId: string,
): Promise<BlockItem | null> {
  const { data, error } = await supabase
    .from('blocks')
    .select(`
      id,
      user_id,
      task_id,
      starts_at,
      ends_at,
      work_minutes,
      status,
      source,
      pinned,
      actual_minutes,
      closed_at,
      notified_at,
      created_at,
      updated_at
    `)
    .eq('id', blockId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    taskId: data.task_id,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    workMinutes: data.work_minutes,
    status: data.status,
    source: data.source,
    pinned: data.pinned,
    actualMinutes: data.actual_minutes,
    closedAt: data.closed_at,
    notifiedAt: data.notified_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
