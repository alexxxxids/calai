import * as z from 'zod';
import { isoWeekday, addDaysToLocalDate } from '@/domain/time';
import type { LocalDate } from '@/domain/types';

export const MIN_HABIT_NAME_LENGTH = 1;
export const MAX_HABIT_NAME_LENGTH = 60;
export const WEEKDAY_MIN = 1;
export const WEEKDAY_MAX = 7;

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const WEEKDAY_LABELS: Record<number, { short: string; full: string }> = {
  1: { short: 'Pn', full: 'Poniedziałek' },
  2: { short: 'Wt', full: 'Wtorek' },
  3: { short: 'Śr', full: 'Środa' },
  4: { short: 'Cz', full: 'Czwartek' },
  5: { short: 'Pt', full: 'Piątek' },
  6: { short: 'So', full: 'Sobota' },
  7: { short: 'Nd', full: 'Niedziela' },
};

const DAYS_IN_WEEK = 7;
export const ALL_WEEKDAYS: number[] = Array.from(
  { length: DAYS_IN_WEEK },
  (_, index) => index + 1,
);

export const isoDateSchema = z
  .string()
  .regex(ISO_DATE_REGEX, 'Nieprawidłowy format daty (oczekiwano YYYY-MM-DD)')
  .refine((val) => {
    const parts = val.split('-').map(Number);
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    if (year === undefined || month === undefined || day === undefined) {
      return false;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Nieistniejąca data w kalendarzu');

export const weekdaySchema = z
  .number()
  .int()
  .min(WEEKDAY_MIN, 'Dzień tygodnia musi być między 1 a 7')
  .max(WEEKDAY_MAX, 'Dzień tygodnia musi być między 1 a 7');

export const weekdaysListSchema = z
  .array(weekdaySchema)
  .min(1, 'Wybierz co najmniej jeden dzień tygodnia')
  .max(WEEKDAY_MAX, 'Maksymalnie 7 dni tygodnia')
  .refine(
    (days) => new Set(days).size === days.length,
    'Dni tygodnia nie mogą się powtarzać',
  )
  .transform((days) => [...days].sort((a, b) => a - b));

export const createHabitSchema = z.object({
  name: z
    .string()
    .trim()
    .min(MIN_HABIT_NAME_LENGTH, 'Nazwa nawyku jest wymagana')
    .max(
      MAX_HABIT_NAME_LENGTH,
      `Nazwa może mieć maksymalnie ${MAX_HABIT_NAME_LENGTH} znaków`,
    ),
  weekdays: weekdaysListSchema,
});

export const updateHabitSchema = z.object({
  id: z.string().uuid('Nieprawidłowy identyfikator nawyku'),
  name: z
    .string()
    .trim()
    .min(MIN_HABIT_NAME_LENGTH, 'Nazwa nawyku jest wymagana')
    .max(
      MAX_HABIT_NAME_LENGTH,
      `Nazwa może mieć maksymalnie ${MAX_HABIT_NAME_LENGTH} znaków`,
    ),
  weekdays: weekdaysListSchema,
});

export const toggleHabitCheckSchema = z.object({
  habitId: z.string().uuid('Nieprawidłowy identyfikator nawyku'),
  day: isoDateSchema,
  done: z.boolean(),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type ToggleHabitCheckInput = z.infer<typeof toggleHabitCheckSchema>;

/**
 * Sprawdza, czy nawyk jest zaplanowany na dany dzień (według ISO 1..7).
 */
export function isHabitScheduledForDay(
  weekdays: readonly number[],
  day: LocalDate,
): boolean {
  const targetDay = isoWeekday(day);
  return weekdays.includes(targetDay);
}

/**
 * Oblicza bieżącą serię wykonania nawyku (streak).
 */
export function calculateStreak(
  checks: ReadonlySet<LocalDate> | readonly LocalDate[],
  referenceDay: LocalDate,
  weekdays: readonly number[],
): number {
  if (weekdays.length === 0) {
    return 0;
  }

  const checksSet = checks instanceof Set ? checks : new Set(checks);
  let streak = 0;
  let currentDay = referenceDay;

  const isScheduledRef = isHabitScheduledForDay(weekdays, currentDay);
  if (isScheduledRef && !checksSet.has(currentDay)) {
    currentDay = addDaysToLocalDate(currentDay, -1);
  }

  const MAX_STREAK_LOOKBACK = 365;
  let iterations = 0;

  while (iterations < MAX_STREAK_LOOKBACK) {
    if (isHabitScheduledForDay(weekdays, currentDay)) {
      if (checksSet.has(currentDay)) {
        streak += 1;
      } else {
        break;
      }
    }
    currentDay = addDaysToLocalDate(currentDay, -1);
    iterations += 1;
  }

  return streak;
}
