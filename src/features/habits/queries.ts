import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { LocalDate } from '@/domain/types';
import { addDaysToLocalDate, instantToLocalDate } from '@/domain/time';
import {
  isHabitScheduledForDay,
  calculateStreak,
} from './schemas';

export type HabitRow = Database['public']['Tables']['habits']['Row'];
export type HabitCheckRow = Database['public']['Tables']['habit_checks']['Row'];

export interface HabitForDay {
  id: string;
  name: string;
  weekdays: number[];
  archived_at: string | null;
  done: boolean;
  streak: number;
}

const STREAK_LOOKBACK_DAYS = 90;

export async function listHabits(
  supabase: SupabaseClient<Database>,
): Promise<HabitRow[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list habits: ${error.message}`);
  }

  return data ?? [];
}

function groupChecksByHabit(
  checks: Array<{ habit_id: string; day: string }>,
): Map<string, Set<LocalDate>> {
  const map = new Map<string, Set<LocalDate>>();
  for (const check of checks) {
    let set = map.get(check.habit_id);
    if (!set) {
      set = new Set<LocalDate>();
      map.set(check.habit_id, set);
    }
    set.add(check.day as LocalDate);
  }
  return map;
}

export async function listHabitsForDay(
  supabase: SupabaseClient<Database>,
  day: LocalDate,
): Promise<HabitForDay[]> {
  const { data: habits, error: habitsError } = await supabase
    .from('habits')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: true });

  if (habitsError) {
    throw new Error(`Failed to list habits: ${habitsError.message}`);
  }

  const scheduled = (habits ?? []).filter((h) =>
    isHabitScheduledForDay(h.weekdays, day),
  );
  if (scheduled.length === 0) {
    return [];
  }

  const startDate = addDaysToLocalDate(day, -STREAK_LOOKBACK_DAYS);
  const habitIds = scheduled.map((h) => h.id);

  const { data: checks, error: checksError } = await supabase
    .from('habit_checks')
    .select('habit_id, day')
    .in('habit_id', habitIds)
    .gte('day', startDate)
    .lte('day', day);

  if (checksError) {
    throw new Error(`Failed to list habit checks: ${checksError.message}`);
  }

  const checksByHabit = groupChecksByHabit(checks ?? []);

  return scheduled.map((habit) => {
    const habitChecks = checksByHabit.get(habit.id) ?? new Set<LocalDate>();
    return {
      id: habit.id,
      name: habit.name,
      weekdays: habit.weekdays,
      archived_at: habit.archived_at,
      done: habitChecks.has(day),
      streak: calculateStreak(habitChecks, day, habit.weekdays),
    };
  });
}

export function getUserTodayDate(timezone: string): LocalDate {
  return instantToLocalDate(Date.now(), timezone);
}
