import { fail, ok, type ActionResult } from '@/lib/action-result';
import { newLocalId, readLocalStore, writeLocalStore } from './local-store';
import type { LocalHabit } from './local-store-types';

const MAX_HABIT_NAME_LENGTH = 60;
const ISO_MONDAY = 1;
const ISO_SUNDAY = 7;
export const ALL_HABIT_WEEKDAYS: readonly number[] = Array.from(
  { length: ISO_SUNDAY },
  (_, idx) => idx + 1,
);

export interface CreateHabitInput {
  readonly name: string;
  readonly weekdays?: readonly number[];
}

export function localCreateHabit(input: CreateHabitInput): ActionResult<LocalHabit> {
  const trimmed = input.name.trim();
  if (!trimmed) {
    return fail('Nazwa nawyku nie może być pusta');
  }
  if (trimmed.length > MAX_HABIT_NAME_LENGTH) {
    return fail(`Nazwa nawyku może mieć maksymalnie ${MAX_HABIT_NAME_LENGTH} znaków`);
  }

  const days = (input.weekdays && input.weekdays.length > 0
    ? input.weekdays
    : ALL_HABIT_WEEKDAYS
  ).filter((d) => d >= ISO_MONDAY && d <= ISO_SUNDAY);

  if (days.length === 0) {
    return fail('Wybierz co najmniej jeden dzień tygodnia');
  }

  const state = readLocalStore();
  const created: LocalHabit = {
    id: newLocalId('hab'),
    name: trimmed,
    weekdays: [...new Set(days)].sort((a, b) => a - b),
    completedDays: [],
  };
  writeLocalStore({ ...state, habits: [...state.habits, created] });
  return ok(created);
}

export function localDeleteHabit(habitId: string): ActionResult<{ readonly id: string }> {
  const state = readLocalStore();
  const exists = state.habits.some((h) => h.id === habitId);
  if (!exists) {
    return fail('Nie znaleziono nawyku');
  }
  writeLocalStore({
    ...state,
    habits: state.habits.filter((h) => h.id !== habitId),
  });
  return ok({ id: habitId });
}
