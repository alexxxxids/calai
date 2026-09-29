'use server';

import { revalidatePath } from 'next/cache';

import { MS_PER_MINUTE } from '@/domain/constants';
import {
  invalidInput,
  ok,
  unauthorized,
  unexpected,
  type ActionResult,
} from '@/lib/action-result';
import { getCurrentUser } from '@/lib/auth';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';

import { replanForUser } from '../planner';
import {
  CALENDAR_PATH,
  TASKS_PATH,
  calculateScaledWorkForMove,
  executeCloseBlock,
  executeDeleteBlock,
  getActiveTask,
  getPlannedBlock,
  insertScheduledBlock,
  updateMovedBlock,
} from './action-helpers';
import {
  calculateTaskPaceForTask,
  deleteOverlappingUnpinnedBlocks,
  evaluateDayLoadWarning,
} from './block-mutation-helpers';
import {
  CloseBlockSchema,
  DeleteBlockSchema,
  MoveBlockSchema,
  ScheduleBlockSchema,
} from './schemas';
import type { MoveBlockResult, ScheduleBlockResult } from './types';

export async function scheduleTaskBlock(
  input: unknown,
): Promise<ActionResult<ScheduleBlockResult>> {
  const parsed = ScheduleBlockSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    const taskRes = await getActiveTask(supabase, user.id, parsed.data.taskId);
    if (!taskRes.ok) {
      return taskRes;
    }

    const { id: taskId, typeId, energy } = taskRes.data;
    const pace = await calculateTaskPaceForTask(supabase, user.id, taskId, typeId);
    const durationMinutes = parsed.data.durationMinutes;
    const workMinutes = Math.max(1, Math.round(durationMinutes / pace));
    const startsAt = parsed.data.start;
    const endsAt = new Date(Date.parse(startsAt) + durationMinutes * MS_PER_MINUTE).toISOString();

    await deleteOverlappingUnpinnedBlocks(supabase, user.id, startsAt, endsAt);

    const insertRes = await insertScheduledBlock(supabase, {
      taskId,
      startsAt,
      endsAt,
      workMinutes,
    });
    if (!insertRes.ok) {
      await replanForUser(supabase, user.id, new Date());
      return insertRes;
    }

    const blockId = insertRes.data;
    await replanForUser(supabase, user.id, new Date());

    const warningRes = await evaluateDayLoadWarning(supabase, user.id, startsAt, {
      durationMinutes,
      energy,
      excludeBlockId: blockId,
    });
    const warning = warningRes.hasWarning ? warningRes.warning : undefined;

    revalidatePath(CALENDAR_PATH);
    revalidatePath(TASKS_PATH);
    return ok({ blockId, warning });
  } catch (err) {
    return unexpected('scheduleTaskBlock', err);
  }
}

interface MoveExecutionPayload {
  readonly blockId: string;
  readonly start: string;
  readonly end: string;
}

async function processMoveBlock(
  supabase: ServerSupabase,
  userId: string,
  payload: MoveExecutionPayload,
): Promise<ActionResult<MoveBlockResult>> {
  const blockRes = await getPlannedBlock(supabase, userId, payload.blockId);
  if (!blockRes.ok) {
    return blockRes;
  }

  const currentBlock = blockRes.data;
  const { newDurationMinutes, workMinutes } = calculateScaledWorkForMove(
    {
      oldStart: currentBlock.startsAt,
      oldEnd: currentBlock.endsAt,
      newStart: payload.start,
      newEnd: payload.end,
    },
    currentBlock.workMinutes,
  );

  await deleteOverlappingUnpinnedBlocks(supabase, userId, {
    startsAt: payload.start,
    endsAt: payload.end,
    excludeBlockId: currentBlock.id,
  });

  const updateRes = await updateMovedBlock(supabase, {
    blockId: currentBlock.id,
    userId,
    startsAt: payload.start,
    endsAt: payload.end,
    workMinutes,
  });
  if (!updateRes.ok) {
    await replanForUser(supabase, userId, new Date());
    return updateRes;
  }

  await replanForUser(supabase, userId, new Date());

  const warningRes = await evaluateDayLoadWarning(supabase, userId, payload.start, {
    durationMinutes: newDurationMinutes,
    energy: currentBlock.energy,
    excludeBlockId: currentBlock.id,
  });
  const warning = warningRes.hasWarning ? warningRes.warning : undefined;

  revalidatePath(CALENDAR_PATH);
  revalidatePath(TASKS_PATH);
  return ok({ blockId: currentBlock.id, warning });
}

export async function moveBlock(input: unknown): Promise<ActionResult<MoveBlockResult>> {
  const parsed = MoveBlockSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    return await processMoveBlock(supabase, user.id, parsed.data);
  } catch (err) {
    return unexpected('moveBlock', err);
  }
}

export async function closeBlock(input: unknown): Promise<ActionResult<{ success: true }>> {
  const parsed = CloseBlockSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    const closeRes = await executeCloseBlock(supabase, user.id, parsed.data);
    if (!closeRes.ok) {
      return closeRes;
    }

    await replanForUser(supabase, user.id, new Date());
    revalidatePath(CALENDAR_PATH);
    revalidatePath(TASKS_PATH);
    return ok({ success: true });
  } catch (err) {
    return unexpected('closeBlock', err);
  }
}

export async function deleteBlock(input: unknown): Promise<ActionResult<{ success: true }>> {
  const parsed = DeleteBlockSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    const deleteRes = await executeDeleteBlock(supabase, user.id, parsed.data.blockId);
    if (!deleteRes.ok) {
      return deleteRes;
    }

    await replanForUser(supabase, user.id, new Date());
    revalidatePath(CALENDAR_PATH);
    revalidatePath(TASKS_PATH);
    return ok({ success: true });
  } catch (err) {
    return unexpected('deleteBlock', err);
  }
}
