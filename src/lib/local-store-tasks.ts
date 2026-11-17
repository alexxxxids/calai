import { MS_PER_MINUTE } from '@/domain/constants';
import { zonedToInstant } from '@/domain/time';
import type { BacklogTaskItem, CreateTaskInput, UpdateTaskInput } from '@/features/tasks/types';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import type { TaskType } from '@/types/db';
import { newLocalId, readLocalStore, resolveIsoInZone, writeLocalStore } from './local-store';
import { DEFAULT_TIMEZONE } from './local-store-seed';
import type { LocalBlock } from './local-store-types';

const ONE_OFF_COLOR = '#6366f1';
const DEFAULT_ENERGY = 2;
const DEFAULT_HARD_DUR = 60;
const HH_MM_LEN = 5;

function resolveTaskTypeForCreate(
  input: CreateTaskInput,
  taskTypes: readonly TaskType[],
): { readonly type: TaskType | undefined; readonly nextTypes: readonly TaskType[] } {
  const existing = taskTypes.find((t) => t.id === input.typeId);
  if (existing) {
    return { type: existing, nextTypes: taskTypes };
  }
  const oneOffName = input.newOneOffTypeName?.trim();
  if (oneOffName) {
    const created: TaskType = {
      id: newLocalId('type'),
      name: oneOffName,
      color: ONE_OFF_COLOR,
      energy: DEFAULT_ENERGY,
      is_one_off: true,
      is_rest: false,
      archived_at: null,
    };
    return { type: created, nextTypes: [...taskTypes, created] };
  }
  return { type: taskTypes[0], nextTypes: taskTypes };
}

function buildHardBlock(input: CreateTaskInput, taskId: string, chosenType: TaskType): LocalBlock {
  const startClock = (input.startTime ?? '09:00').slice(0, HH_MM_LEN);
  const startMs = zonedToInstant(input.date ?? '', startClock, input.timeZone);
  const dur = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : DEFAULT_HARD_DUR;
  return {
    id: newLocalId('block'),
    taskId,
    typeId: chosenType.id,
    title: chosenType.name,
    notes: input.notes ?? null,
    startsAt: new Date(startMs).toISOString(),
    endsAt: new Date(startMs + dur * MS_PER_MINUTE).toISOString(),
    workMinutes: dur,
    status: 'planned',
    source: 'manual',
    pinned: true,
    actualMinutes: null,
  };
}

function resolveDeadlineIso(
  date: string | null | undefined,
  time: string | null | undefined,
  timeZone = DEFAULT_TIMEZONE,
): string | null {
  if (!date) {
    return null;
  }
  const clock = time && time.length >= HH_MM_LEN ? time.slice(0, HH_MM_LEN) : '23:59';
  return resolveIsoInZone(date, clock, timeZone);
}

export function localCreateTask(input: CreateTaskInput): ActionResult<{ readonly taskId: string }> {
  const state = readLocalStore();
  const { type: chosenType, nextTypes } = resolveTaskTypeForCreate(input, state.taskTypes);
  if (!chosenType) {
    return fail('Wybierz typ zadania');
  }

  const taskId = newLocalId('task');
  if (input.fixation === 'hard' && input.date && input.startTime) {
    const hardBlock = buildHardBlock(input, taskId, chosenType);
    writeLocalStore({ ...state, taskTypes: nextTypes, blocks: [...state.blocks, hardBlock] });
    return ok({ taskId });
  }

  const newTask: BacklogTaskItem = {
    id: taskId,
    typeId: chosenType.id,
    typeName: chosenType.name,
    typeColor: chosenType.color,
    typeEnergy: chosenType.energy,
    isOneOff: chosenType.is_one_off,
    priority: input.priority,
    fixation: input.fixation,
    notes: input.notes ?? null,
    estimateMinutes: input.estimateMinutes ?? null,
    sessionMinutes: input.sessionMinutes ?? null,
    deadline: resolveDeadlineIso(input.deadlineDate, input.deadlineTime, input.timeZone),
    createdAt: new Date().toISOString(),
    typePace: 1,
  };
  writeLocalStore({ ...state, taskTypes: nextTypes, tasks: [newTask, ...state.tasks] });
  return ok({ taskId });
}

function resolveTypeFields(task: BacklogTaskItem, chosenType: TaskType | undefined) {
  if (!chosenType) {
    return {
      typeId: task.typeId,
      typeName: task.typeName,
      typeColor: task.typeColor,
      typeEnergy: task.typeEnergy,
    };
  }
  return {
    typeId: chosenType.id,
    typeName: chosenType.name,
    typeColor: chosenType.color,
    typeEnergy: chosenType.energy,
  };
}

function applyTaskUpdate(
  task: BacklogTaskItem,
  input: UpdateTaskInput,
  chosenType: TaskType | undefined,
): BacklogTaskItem {
  return {
    ...task,
    ...resolveTypeFields(task, chosenType),
    priority: input.priority,
    notes: input.notes ?? null,
    estimateMinutes: input.estimateMinutes ?? null,
    sessionMinutes: input.sessionMinutes ?? null,
    deadline: resolveDeadlineIso(input.deadlineDate, input.deadlineTime, input.timeZone),
  };
}

export function localUpdateTask(input: UpdateTaskInput): ActionResult<{ readonly taskId: string }> {
  const state = readLocalStore();
  const chosenType = state.taskTypes.find((t) => t.id === input.typeId);
  const updated = state.tasks.map((t) =>
    t.id === input.taskId ? applyTaskUpdate(t, input, chosenType) : t,
  );
  writeLocalStore({ ...state, tasks: updated });
  return ok({ taskId: input.taskId });
}

export function localCompleteTask(taskId: string): ActionResult<{ readonly taskId: string }> {
  const state = readLocalStore();
  writeLocalStore({ ...state, tasks: state.tasks.filter((t) => t.id !== taskId) });
  return ok({ taskId });
}

export function localCancelTask(taskId: string): ActionResult<{ readonly taskId: string }> {
  const state = readLocalStore();
  writeLocalStore({
    ...state,
    tasks: state.tasks.filter((t) => t.id !== taskId),
    blocks: state.blocks.filter((b) => b.taskId !== taskId || b.status !== 'planned'),
  });
  return ok({ taskId });
}
