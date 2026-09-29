import { fail, ok, type ActionResult } from '@/lib/action-result';
import type { ServerSupabase } from '@/lib/supabase/server';

import { DEFAULT_ONE_OFF_COLOR, DEFAULT_ONE_OFF_ENERGY } from './schemas';

export const BLOCK_OVERLAP_ERROR_MESSAGE = 'W wybranym czasie istnieje już inne wydarzenie';
const DUPLICATE_KEY_CODE = '23505';
const EXCLUSION_ERROR_CODE = '23P01';

export async function createOneOffTaskType(
  supabase: ServerSupabase,
  userId: string,
  typeName: string,
): Promise<ActionResult<string>> {
  const { data, error } = await supabase
    .from('task_types')
    .insert({
      user_id: userId,
      name: typeName,
      color: DEFAULT_ONE_OFF_COLOR,
      energy: DEFAULT_ONE_OFF_ENERGY,
      is_one_off: true,
      is_rest: false,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === DUPLICATE_KEY_CODE) {
      return fail('Typ o tej nazwie już istnieje');
    }
    return fail('Nie udało się utworzyć typu zadania');
  }

  return ok(data.id);
}

export async function deleteOverlappingUnpinnedBlocks(
  supabase: ServerSupabase,
  userId: string,
  startsAt: string,
  endsAt: string,
): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('user_id', userId)
    .eq('status', 'planned')
    .eq('pinned', false)
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt);

  if (error) {
    throw new Error(`Błąd usuwania nakładających się bloków: ${error.message}`);
  }
}

export interface HardBlockInput {
  readonly taskId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly workMinutes: number;
}

export async function createHardTaskBlock(
  supabase: ServerSupabase,
  userId: string,
  input: HardBlockInput,
): Promise<void> {
  const { error } = await supabase.from('blocks').insert({
    user_id: userId,
    task_id: input.taskId,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    work_minutes: input.workMinutes,
    status: 'planned',
    source: 'manual',
    pinned: true,
  });

  if (error) {
    if (error.code === EXCLUSION_ERROR_CODE) {
      throw new Error(BLOCK_OVERLAP_ERROR_MESSAGE);
    }
    throw new Error(`Błąd tworzenia bloku zadania sztywnego: ${error.message}`);
  }
}

export async function deleteFuturePlannedBlocks(
  supabase: ServerSupabase,
  userId: string,
  taskId: string,
  nowIso: string,
): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .eq('status', 'planned')
    .gt('ends_at', nowIso);

  if (error) {
    throw new Error(`Błąd usuwania przyszłych bloków: ${error.message}`);
  }
}

export async function archiveOneOffType(
  supabase: ServerSupabase,
  userId: string,
  typeId: string,
  nowIso: string,
): Promise<void> {
  const { error } = await supabase
    .from('task_types')
    .update({ archived_at: nowIso })
    .eq('id', typeId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Błąd archiwizacji typu zadania: ${error.message}`);
  }
}
