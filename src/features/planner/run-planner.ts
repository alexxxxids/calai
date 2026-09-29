'use server';

import { revalidatePath } from 'next/cache';

import type { UnscheduledWork } from '@/domain/types';
import {
  fail,
  ok,
  unauthorized,
  unexpected,
  type ActionResult,
} from '@/lib/action-result';
import { getCurrentUser } from '@/lib/auth';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';

import { replanForUser } from './replan';
import type { RunPlannerResult, UnscheduledItem } from './types';

const CONFLICT_ERROR_MESSAGE = 'Plan się zmienił, spróbuj ponownie';
const DEFAULT_TASK_TITLE = 'Zadanie';
const CALENDAR_PATH = '/calendar';
const MAX_NOTE_SNIPPET_LENGTH = 80;

interface PartialTask {
  readonly id: string;
  readonly notes: string | null;
  readonly type_id: string;
}

interface PartialType {
  readonly id: string;
  readonly name: string;
}

function formatTaskTitle(typeName: string, notes: string | null | undefined): string {
  const trimmed = notes?.trim();
  if (trimmed && trimmed.length > 0) {
    const snippet =
      trimmed.length > MAX_NOTE_SNIPPET_LENGTH
        ? `${trimmed.slice(0, MAX_NOTE_SNIPPET_LENGTH)}...`
        : trimmed;
    return `${typeName}: ${snippet}`;
  }
  return typeName;
}

async function fetchTasks(
  supabase: ServerSupabase,
  taskIds: readonly string[],
): Promise<readonly PartialTask[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, notes, type_id')
    .in('id', [...taskIds]);

  if (error) {
    throw new Error(`Błąd pobierania zadań: ${error.message}`);
  }
  return (data ?? []) as readonly PartialTask[];
}

async function fetchTypeNames(
  supabase: ServerSupabase,
  typeIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (typeIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('task_types')
    .select('id, name')
    .in('id', [...typeIds]);

  if (error) {
    throw new Error(`Błąd pobierania typów: ${error.message}`);
  }

  const typeMap = new Map<string, string>();
  for (const t of (data ?? []) as readonly PartialType[]) {
    typeMap.set(t.id, t.name);
  }
  return typeMap;
}

async function resolveUnscheduledItems(
  supabase: ServerSupabase,
  unscheduled: readonly UnscheduledWork[],
): Promise<UnscheduledItem[]> {
  const taskIds = Array.from(new Set(unscheduled.map((u) => u.taskId)));
  const tasks = await fetchTasks(supabase, taskIds);
  const typeIds = Array.from(new Set(tasks.map((t) => t.type_id)));
  const typeMap = await fetchTypeNames(supabase, typeIds);

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  return unscheduled.map((item) => {
    const task = taskMap.get(item.taskId);
    const typeName = (task ? typeMap.get(task.type_id) : undefined) ?? DEFAULT_TASK_TITLE;
    return {
      taskId: item.taskId,
      taskTitle: formatTaskTitle(typeName, task?.notes),
      missingMinutes: item.missingMinutes,
      reason: item.reason,
    };
  });
}

/**
 * Server Action that triggers replanning for the current authenticated user.
 * Revalidates the calendar route upon completion.
 */
export async function runPlanner(): Promise<ActionResult<RunPlannerResult>> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    const result = await replanForUser(supabase, user.id, new Date());

    if (result.unscheduled.length === 0) {
      revalidatePath(CALENDAR_PATH);
      return ok({ placed: result.placed, unscheduled: [] });
    }

    const unscheduledItems = await resolveUnscheduledItems(supabase, result.unscheduled);
    revalidatePath(CALENDAR_PATH);
    return ok({ placed: result.placed, unscheduled: unscheduledItems });
  } catch (err) {
    if (err instanceof Error && err.message === CONFLICT_ERROR_MESSAGE) {
      return fail(CONFLICT_ERROR_MESSAGE);
    }
    return unexpected('runPlanner', err);
  }
}
