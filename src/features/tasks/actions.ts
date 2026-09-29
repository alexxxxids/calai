'use server';

import { revalidatePath } from 'next/cache';

import {
  fail,
  invalidInput,
  ok,
  unauthorized,
  unexpected,
  type ActionResult,
} from '@/lib/action-result';
import { getCurrentUser } from '@/lib/auth';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

import { replanForUser } from '../planner';
import {
  BLOCK_OVERLAP_ERROR_MESSAGE,
  archiveOneOffType,
  createHardTaskBlock,
  createOneOffTaskType,
  deleteFuturePlannedBlocks,
  deleteOverlappingUnpinnedBlocks,
} from './action-helpers';
import {
  CancelTaskSchema,
  CompleteTaskSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  type CreateTaskPayload,
  type UpdateTaskPayload,
} from './schemas';

const CALENDAR_PATH = '/calendar';
const CONFLICT_ERROR_MESSAGE = 'Plan się zmienił, spróbuj ponownie';

type TaskUpdateRow = Database['public']['Tables']['tasks']['Update'];

function buildTaskUpdatePayload(data: UpdateTaskPayload): TaskUpdateRow {
  const payload: TaskUpdateRow = {};
  if (data.typeId !== undefined) {
    payload.type_id = data.typeId;
  }
  if (data.priority !== undefined) {
    payload.priority = data.priority;
  }
  if (data.notes !== undefined) {
    payload.notes = data.notes;
  }
  if (data.estimateMinutes !== undefined) {
    payload.estimate_minutes = data.estimateMinutes;
  }
  if (data.sessionMinutes !== undefined) {
    payload.session_minutes = data.sessionMinutes;
  }
  if (data.deadline !== undefined) {
    payload.deadline = data.deadline;
  }
  return payload;
}

async function resolveTaskTypeId(
  supabase: ServerSupabase,
  userId: string,
  payload: CreateTaskPayload,
): Promise<ActionResult<string>> {
  if (payload.newOneOffTypeName) {
    return createOneOffTaskType(supabase, userId, payload.newOneOffTypeName);
  }
  if (!payload.typeId) {
    return fail('Wybierz typ zadania');
  }
  return ok(payload.typeId);
}

async function insertTaskRow(
  supabase: ServerSupabase,
  userId: string,
  typeId: string,
  payload: CreateTaskPayload,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      type_id: typeId,
      priority: payload.priority,
      fixation: payload.fixation,
      notes: payload.notes,
      estimate_minutes: payload.estimateMinutes,
      session_minutes: payload.sessionMinutes,
      deadline: payload.deadline,
      status: 'active',
    })
    .select('id')
    .single();

  if (error || !data) {
    return null;
  }
  return data.id;
}

async function handlePostCreateSchedule(
  supabase: ServerSupabase,
  userId: string,
  taskId: string,
  payload: CreateTaskPayload,
): Promise<void> {
  if (payload.fixation === 'hard') {
    const startsAt = payload.startsAt!;
    const endsAt = payload.endsAt!;
    const workMinutes = payload.durationMinutes!;
    await deleteOverlappingUnpinnedBlocks(supabase, userId, startsAt, endsAt);
    await createHardTaskBlock(supabase, userId, { taskId, startsAt, endsAt, workMinutes });
    await replanForUser(supabase, userId, new Date());
  } else if (payload.estimateMinutes !== null) {
    await replanForUser(supabase, userId, new Date());
  }
}

async function scheduleNewTask(
  supabase: ServerSupabase,
  userId: string,
  taskId: string,
  payload: CreateTaskPayload,
): Promise<ActionResult<null>> {
  try {
    await handlePostCreateSchedule(supabase, userId, taskId, payload);
    return ok(null);
  } catch (schedErr) {
    if (schedErr instanceof Error && schedErr.message === BLOCK_OVERLAP_ERROR_MESSAGE) {
      await supabase.from('tasks').delete().eq('id', taskId).eq('user_id', userId);
      return fail(BLOCK_OVERLAP_ERROR_MESSAGE);
    }
    throw schedErr;
  }
}

export async function createTask(input: unknown): Promise<ActionResult<{ taskId: string }>> {
  const parsed = CreateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    const typeRes = await resolveTaskTypeId(supabase, user.id, parsed.data);
    if (!typeRes.ok) {
      return typeRes;
    }

    const taskId = await insertTaskRow(supabase, user.id, typeRes.data, parsed.data);
    if (!taskId) {
      return fail('Nie udało się utworzyć zadania');
    }

    const schedRes = await scheduleNewTask(supabase, user.id, taskId, parsed.data);
    if (!schedRes.ok) {
      return schedRes;
    }

    revalidatePath(CALENDAR_PATH);
    return ok({ taskId });
  } catch (err) {
    if (err instanceof Error && err.message === CONFLICT_ERROR_MESSAGE) {
      return fail(CONFLICT_ERROR_MESSAGE);
    }
    return unexpected('createTask', err);
  }
}

function checkNeedsReplan(
  existingFixation: 'flexible' | 'hard',
  existingEstimate: number | null,
  newEstimate: number | null | undefined,
): boolean {
  if (existingFixation !== 'flexible') {
    return false;
  }
  const effective = newEstimate !== undefined ? newEstimate : existingEstimate;
  return effective !== null || existingEstimate !== null;
}

export async function updateTask(input: unknown): Promise<ActionResult<{ taskId: string }>> {
  const parsed = UpdateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('tasks')
      .select('id, fixation, estimate_minutes')
      .eq('id', parsed.data.taskId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return fail('Nie znaleziono zadania');
    }

    const payload = buildTaskUpdatePayload(parsed.data);
    const { error: updateErr } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', parsed.data.taskId)
      .eq('user_id', user.id);

    if (updateErr) {
      return fail('Nie udało się zaktualizować zadania');
    }

    if (checkNeedsReplan(existing.fixation, existing.estimate_minutes, parsed.data.estimateMinutes)) {
      await replanForUser(supabase, user.id, new Date());
    }

    revalidatePath(CALENDAR_PATH);
    return ok({ taskId: parsed.data.taskId });
  } catch (err) {
    if (err instanceof Error && err.message === CONFLICT_ERROR_MESSAGE) {
      return fail(CONFLICT_ERROR_MESSAGE);
    }
    return unexpected('updateTask', err);
  }
}

async function transitionTaskStatus(
  supabase: ServerSupabase,
  userId: string,
  taskId: string,
  targetStatus: 'done' | 'cancelled',
): Promise<ActionResult<{ success: true }>> {
  const { data: task, error: fetchErr } = await supabase
    .from('tasks')
    .select(`
      id,
      status,
      type_id,
      task_types!inner (
        id,
        is_one_off
      )
    `)
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr || !task) {
    return fail('Nie znaleziono zadania');
  }

  if (task.status !== 'active') {
    return fail('Zadanie nie jest aktywne');
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const updateFields =
    targetStatus === 'done'
      ? { status: 'done' as const, completed_at: nowIso }
      : { status: 'cancelled' as const };

  const { error: updateErr } = await supabase
    .from('tasks')
    .update(updateFields)
    .eq('id', taskId)
    .eq('user_id', userId);

  if (updateErr) {
    return fail('Nie udało się zaktualizować statusu zadania');
  }

  await deleteFuturePlannedBlocks(supabase, userId, taskId, nowIso);

  if (task.task_types.is_one_off) {
    await archiveOneOffType(supabase, userId, task.type_id, nowIso);
  }

  await replanForUser(supabase, userId, now);
  revalidatePath(CALENDAR_PATH);
  return ok({ success: true });
}

export async function completeTask(input: unknown): Promise<ActionResult<{ success: true }>> {
  const parsed = CompleteTaskSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    return await transitionTaskStatus(supabase, user.id, parsed.data.taskId, 'done');
  } catch (err) {
    if (err instanceof Error && err.message === CONFLICT_ERROR_MESSAGE) {
      return fail(CONFLICT_ERROR_MESSAGE);
    }
    return unexpected('completeTask', err);
  }
}

export async function cancelTask(input: unknown): Promise<ActionResult<{ success: true }>> {
  const parsed = CancelTaskSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    return await transitionTaskStatus(supabase, user.id, parsed.data.taskId, 'cancelled');
  } catch (err) {
    if (err instanceof Error && err.message === CONFLICT_ERROR_MESSAGE) {
      return fail(CONFLICT_ERROR_MESSAGE);
    }
    return unexpected('cancelTask', err);
  }
}
