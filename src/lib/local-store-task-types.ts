import { ok, fail, type ActionResult } from '@/lib/action-result';
import type { TaskType } from '@/types/db';
import { newLocalId, readLocalStore, writeLocalStore } from './local-store';

export interface CreateLocalTaskTypeInput {
  readonly name: string;
  readonly color: string;
  readonly energy: number;
}

const MAX_TYPE_NAME_LEN = 60;
const MIN_ENERGY = 0;
const MAX_ENERGY = 3;

export function countTaskTypeUsage(typeId: string): number {
  const state = readLocalStore();
  const tasksCount = state.tasks.filter((t) => t.typeId === typeId).length;
  const blocksCount = state.blocks.filter((b) => b.typeId === typeId).length;
  const recCount = state.recurringEvents.filter((r) => r.type_id === typeId).length;
  return tasksCount + blocksCount + recCount;
}

export function localCreateTaskType(input: CreateLocalTaskTypeInput): ActionResult<TaskType> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    return fail('Nazwa typu nie może być pusta');
  }
  if (trimmedName.length > MAX_TYPE_NAME_LEN) {
    return fail(`Nazwa typu może mieć maksymalnie ${MAX_TYPE_NAME_LEN} znaków`);
  }

  const state = readLocalStore();
  const duplicate = state.taskTypes.some(
    (t) => t.name.toLowerCase() === trimmedName.toLowerCase(),
  );
  if (duplicate) {
    return fail('Typ zadania o takiej nazwie już istnieje');
  }

  const clampedEnergy = Math.min(MAX_ENERGY, Math.max(MIN_ENERGY, Math.round(input.energy)));
  const created: TaskType = {
    id: newLocalId('type'),
    name: trimmedName,
    color: input.color,
    energy: clampedEnergy,
    is_one_off: false,
    is_rest: false,
    archived_at: null,
  };
  writeLocalStore({ ...state, taskTypes: [...state.taskTypes, created] });
  return ok(created);
}

export function localDeleteTaskType(typeId: string): ActionResult<{ readonly id: string }> {
  const state = readLocalStore();
  const catalogTypes = state.taskTypes.filter((t) => !t.is_one_off);
  const target = state.taskTypes.find((t) => t.id === typeId);
  if (!target) {
    return fail('Nie znaleziono typu zadania');
  }
  if (!target.is_one_off && catalogTypes.length <= 1) {
    return fail('Musi pozostać co najmniej jeden typ zadania');
  }

  writeLocalStore({
    ...state,
    taskTypes: state.taskTypes.filter((t) => t.id !== typeId),
    tasks: state.tasks.filter((t) => t.typeId !== typeId),
    blocks: state.blocks.filter((b) => b.typeId !== typeId),
    recurringEvents: state.recurringEvents.filter((r) => r.type_id !== typeId),
  });
  return ok({ id: typeId });
}
