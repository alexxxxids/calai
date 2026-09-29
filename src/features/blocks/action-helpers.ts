import 'server-only';

import { MS_PER_MINUTE } from '@/domain/constants';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import type { ServerSupabase } from '@/lib/supabase/server';

import type { CloseBlockInput } from './types';
import { scaleWorkMinutes } from './work-scaling';

export const EXCLUSION_VIOLATION_CODE = '23P01';
export const OCCUPIED_SLOT_MESSAGE = 'Ten termin jest zajęty';
export const TASK_NOT_FOUND_MESSAGE = 'Nie znaleziono zadania';
export const TASK_NOT_ACTIVE_MESSAGE = 'Zadanie nie jest aktywne';
export const BLOCK_NOT_FOUND_MESSAGE = 'Nie znaleziono bloku';
export const BLOCK_NOT_PLANNED_MESSAGE = 'Można modyfikować tylko zaplanowane bloki';
export const BLOCK_ALREADY_CLOSED_MESSAGE = 'Ten blok został już zamknięty';
export const SCHEDULE_BLOCK_FAILED_MESSAGE = 'Nie udało się zaplanować bloku zadania';
export const MOVE_BLOCK_FAILED_MESSAGE = 'Nie udało się przenieść bloku';
export const CLOSE_BLOCK_FAILED_MESSAGE = 'Nie udało się zamknąć bloku';
export const DELETE_BLOCK_FAILED_MESSAGE = 'Nie udało się usunąć bloku';
export const CANNOT_DELETE_CLOSED_BLOCK_MESSAGE = 'Nie można usunąć zamkniętego bloku';
export const CALENDAR_PATH = '/calendar';
export const TASKS_PATH = '/tasks';

const DEFAULT_BLOCK_ENERGY = 0;

export interface ActiveTaskData {
  readonly id: string;
  readonly typeId: string;
  readonly energy: number;
}

export async function getActiveTask(
  supabase: ServerSupabase,
  userId: string,
  taskId: string,
): Promise<ActionResult<ActiveTaskData>> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id,
      status,
      type_id,
      task_types (
        energy
      )
    `)
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return fail(TASK_NOT_FOUND_MESSAGE);
  }

  if (data.status !== 'active') {
    return fail(TASK_NOT_ACTIVE_MESSAGE);
  }

  return ok({
    id: data.id,
    typeId: data.type_id,
    energy: data.task_types?.energy ?? DEFAULT_BLOCK_ENERGY,
  });
}

export interface InsertBlockPayload {
  readonly taskId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly workMinutes: number;
}

export async function insertScheduledBlock(
  supabase: ServerSupabase,
  payload: InsertBlockPayload,
): Promise<ActionResult<string>> {
  const { data, error } = await supabase
    .from('blocks')
    .insert({
      task_id: payload.taskId,
      starts_at: payload.startsAt,
      ends_at: payload.endsAt,
      work_minutes: payload.workMinutes,
      status: 'planned',
      source: 'manual',
      pinned: true,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === EXCLUSION_VIOLATION_CODE) {
      return fail(OCCUPIED_SLOT_MESSAGE);
    }
    return fail(SCHEDULE_BLOCK_FAILED_MESSAGE);
  }

  if (!data) {
    return fail(SCHEDULE_BLOCK_FAILED_MESSAGE);
  }

  return ok(data.id);
}

export interface PlannedBlockData {
  readonly id: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly workMinutes: number;
  readonly energy: number;
}

export async function getPlannedBlock(
  supabase: ServerSupabase,
  userId: string,
  blockId: string,
): Promise<ActionResult<PlannedBlockData>> {
  const { data, error } = await supabase
    .from('blocks')
    .select(`
      id,
      status,
      starts_at,
      ends_at,
      work_minutes,
      tasks (
        task_types (
          energy
        )
      )
    `)
    .eq('id', blockId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return fail(BLOCK_NOT_FOUND_MESSAGE);
  }

  if (data.status !== 'planned') {
    return fail(BLOCK_NOT_PLANNED_MESSAGE);
  }

  return ok({
    id: data.id,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    workMinutes: data.work_minutes,
    energy: data.tasks?.task_types?.energy ?? DEFAULT_BLOCK_ENERGY,
  });
}

export interface UpdateMovedBlockPayload {
  readonly blockId: string;
  readonly userId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly workMinutes: number;
}

export async function updateMovedBlock(
  supabase: ServerSupabase,
  payload: UpdateMovedBlockPayload,
): Promise<ActionResult<{ success: true }>> {
  const { error } = await supabase
    .from('blocks')
    .update({
      starts_at: payload.startsAt,
      ends_at: payload.endsAt,
      work_minutes: payload.workMinutes,
      pinned: true,
    })
    .eq('id', payload.blockId)
    .eq('user_id', payload.userId);

  if (error) {
    if (error.code === EXCLUSION_VIOLATION_CODE) {
      return fail(OCCUPIED_SLOT_MESSAGE);
    }
    return fail(MOVE_BLOCK_FAILED_MESSAGE);
  }

  return ok({ success: true });
}

export async function executeCloseBlock(
  supabase: ServerSupabase,
  userId: string,
  input: CloseBlockInput,
): Promise<ActionResult<{ success: true }>> {
  const { data: existing, error: fetchErr } = await supabase
    .from('blocks')
    .select('id, status')
    .eq('id', input.blockId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return fail(BLOCK_NOT_FOUND_MESSAGE);
  }

  if (existing.status !== 'planned') {
    return fail(BLOCK_ALREADY_CLOSED_MESSAGE);
  }

  const nowIso = new Date().toISOString();
  const actualMinutes = input.status === 'done' ? (input.actualMinutes ?? null) : null;

  const { data: updated, error: updateErr } = await supabase
    .from('blocks')
    .update({
      status: input.status,
      actual_minutes: actualMinutes,
      closed_at: nowIso,
    })
    .eq('id', input.blockId)
    .eq('user_id', userId)
    .eq('status', 'planned')
    .select('id');

  if (updateErr) {
    return fail(CLOSE_BLOCK_FAILED_MESSAGE);
  }

  if (!updated || updated.length === 0) {
    return fail(BLOCK_ALREADY_CLOSED_MESSAGE);
  }

  return ok({ success: true });
}

export async function executeDeleteBlock(
  supabase: ServerSupabase,
  userId: string,
  blockId: string,
): Promise<ActionResult<{ success: true }>> {
  const { data: existing, error: fetchErr } = await supabase
    .from('blocks')
    .select('id, status')
    .eq('id', blockId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return fail(BLOCK_NOT_FOUND_MESSAGE);
  }

  if (existing.status !== 'planned') {
    return fail(CANNOT_DELETE_CLOSED_BLOCK_MESSAGE);
  }

  const { data: deleted, error: deleteErr } = await supabase
    .from('blocks')
    .delete()
    .eq('id', blockId)
    .eq('user_id', userId)
    .eq('status', 'planned')
    .select('id');

  if (deleteErr) {
    return fail(DELETE_BLOCK_FAILED_MESSAGE);
  }

  if (!deleted || deleted.length === 0) {
    return fail(BLOCK_NOT_FOUND_MESSAGE);
  }

  return ok({ success: true });
}

export interface MoveIntervals {
  readonly oldStart: string;
  readonly oldEnd: string;
  readonly newStart: string;
  readonly newEnd: string;
}

export interface ScaledWorkResult {
  readonly newDurationMinutes: number;
  readonly workMinutes: number;
}

export function calculateScaledWorkForMove(
  intervals: MoveIntervals,
  currentWorkMinutes: number,
): ScaledWorkResult {
  const oldDurationMinutes = Math.round(
    (Date.parse(intervals.oldEnd) - Date.parse(intervals.oldStart)) / MS_PER_MINUTE,
  );
  const newDurationMinutes = Math.round(
    (Date.parse(intervals.newEnd) - Date.parse(intervals.newStart)) / MS_PER_MINUTE,
  );
  const workMinutes = scaleWorkMinutes(
    currentWorkMinutes,
    oldDurationMinutes,
    newDurationMinutes,
  );
  return { newDurationMinutes, workMinutes };
}
