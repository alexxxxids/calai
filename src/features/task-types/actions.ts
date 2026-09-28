'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  ok,
  fail,
  invalidInput,
  unauthorized,
  unexpected,
  type ActionResult,
} from '@/lib/action-result';
import {
  CreateTaskTypeSchema,
  UpdateTaskTypeSchema,
  ArchiveTaskTypeSchema,
} from './schemas';
import type { TaskTypeRow } from './queries';

const DUPLICATE_KEY_CODE = '23505';
const REST_ENERGY_LEVEL = 0;

/**
 * Creates a new active custom task type for the current user.
 */
export async function createTaskType(
  input: unknown
): Promise<ActionResult<TaskTypeRow>> {
  const parsed = CreateTaskTypeSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    const { data, error } = await supabase
      .from('task_types')
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        color: parsed.data.color,
        energy: parsed.data.energy,
        is_one_off: false,
        is_rest: false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === DUPLICATE_KEY_CODE) {
        return fail('Typ o tej nazwie już istnieje');
      }
      return fail(`Nie udało się utworzyć typu: ${error.message}`);
    }

    revalidatePath('/types');
    return ok(data);
  } catch (err) {
    return unexpected('Błąd podczas tworzenia typu zadania', err);
  }
}

/**
 * Updates an existing task type. Rest types always keep energy 0.
 */
export async function updateTaskType(
  input: unknown
): Promise<ActionResult<{ success: true }>> {
  const parsed = UpdateTaskTypeSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('task_types')
      .select('is_rest')
      .eq('id', parsed.data.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError || !existing) {
      return fail('Nie znaleziono typu zadania');
    }

    const energy = existing.is_rest ? REST_ENERGY_LEVEL : parsed.data.energy;

    const { error } = await supabase
      .from('task_types')
      .update({
        name: parsed.data.name,
        color: parsed.data.color,
        energy,
      })
      .eq('id', parsed.data.id)
      .eq('user_id', user.id);

    if (error) {
      if (error.code === DUPLICATE_KEY_CODE) {
        return fail('Typ o tej nazwie już istnieje');
      }
      return fail(`Nie udało się zaktualizować typu: ${error.message}`);
    }

    revalidatePath('/types');
    return ok({ success: true });
  } catch (err) {
    return unexpected('Błąd podczas aktualizacji typu zadania', err);
  }
}

/**
 * Archives a task type. System rest types cannot be archived.
 */
export async function archiveTaskType(
  input: unknown
): Promise<ActionResult<{ success: true }>> {
  const parsed = ArchiveTaskTypeSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('task_types')
      .select('is_rest')
      .eq('id', parsed.data.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError || !existing) {
      return fail('Nie znaleziono typu zadania');
    }

    if (existing.is_rest) {
      return fail('Nie można zarchiwizować systemowego typu odpoczynku');
    }

    const { error } = await supabase
      .from('task_types')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', parsed.data.id)
      .eq('user_id', user.id);

    if (error) {
      return fail(`Nie udało się zarchiwizować typu: ${error.message}`);
    }

    revalidatePath('/types');
    return ok({ success: true });
  } catch (err) {
    return unexpected('Błąd podczas archiwizacji typu zadania', err);
  }
}
