import 'server-only';
import type { ServerSupabase } from '@/lib/supabase/server';
import { getProfile, type ProfileRow } from '@/features/profile/queries';
import {
  aggregateTypeStats,
  canAccessMonthlyReflection,
  canAccessWeeklyReflection,
  getCurrentMonthStart,
  getCurrentWeekStart,
  getMonthInterval,
  getPreviousMonthStart,
  getPreviousWeekStart,
} from './rules';
import type {
  MonthlyReflectionState,
  ReflectionState,
  WeeklyReflectionState,
} from './types';

interface MonthlyStateParams {
  readonly supabase: ServerSupabase;
  readonly userId: string;
  readonly currentMonth: string;
  readonly previousMonth: string;
  readonly timezone: string;
}

async function loadWeeklyState(
  supabase: ServerSupabase,
  userId: string,
  currentWeek: string,
  previousWeek: string,
): Promise<WeeklyReflectionState> {
  const { data: weeklyRows, error: weeklyError } = await supabase
    .from('weekly_reflections')
    .select('*')
    .eq('user_id', userId)
    .in('week_start', [currentWeek, previousWeek]);

  if (weeklyError) {
    throw weeklyError;
  }

  const currentReflection = weeklyRows?.find((r) => r.week_start === currentWeek) ?? null;
  const previousReflection = weeklyRows?.find((r) => r.week_start === previousWeek) ?? null;

  return {
    currentWeek,
    previousWeek,
    currentReflection,
    previousReflection,
  };
}

async function loadMonthlyTypeStats(
  supabase: ServerSupabase,
  month: string,
  timezone: string,
) {
  const interval = getMonthInterval(month, timezone);
  const result = await supabase.rpc('type_stats', {
    p_from: interval.fromIso,
    p_to: interval.toIso,
  });

  if (result.error) {
    throw result.error;
  }

  return aggregateTypeStats(result.data ?? []);
}

async function loadMonthlyState(params: MonthlyStateParams): Promise<MonthlyReflectionState> {
  const { supabase, userId, currentMonth, previousMonth, timezone } = params;

  const { data: monthlyRows, error: monthlyError } = await supabase
    .from('monthly_reflections')
    .select('*')
    .eq('user_id', userId)
    .in('month', [currentMonth, previousMonth]);

  if (monthlyError) {
    throw monthlyError;
  }

  const [currentStats, previousStats] = await Promise.all([
    loadMonthlyTypeStats(supabase, currentMonth, timezone),
    loadMonthlyTypeStats(supabase, previousMonth, timezone),
  ]);

  const currentReflection = monthlyRows?.find((r) => r.month === currentMonth) ?? null;
  const previousReflection = monthlyRows?.find((r) => r.month === previousMonth) ?? null;

  return {
    currentMonth,
    previousMonth,
    currentReflection,
    previousReflection,
    currentStats,
    previousStats,
  };
}

/**
 * Loads user reflection state for the current and previous periods.
 * An optional cachedProfile parameter avoids duplicate database queries when
 * the profile has already been retrieved by the caller (e.g. in Server Components).
 */
export async function getReflectionState(
  supabase: ServerSupabase,
  userId: string,
  now = new Date(),
  profile?: ProfileRow,
): Promise<ReflectionState> {
  const profileRow = profile ?? (await getProfile(supabase, userId));
  if (!profileRow) {
    throw new Error('Nie znaleziono profilu użytkownika.');
  }

  const { timezone, reflection_level, display_name } = profileRow;
  const currentWeek = getCurrentWeekStart(now, timezone);
  const previousWeek = getPreviousWeekStart(now, timezone);
  const currentMonth = getCurrentMonthStart(now, timezone);
  const previousMonth = getPreviousMonthStart(currentMonth);

  const weekly = canAccessWeeklyReflection(reflection_level)
    ? await loadWeeklyState(supabase, userId, currentWeek, previousWeek)
    : null;

  const monthly = canAccessMonthlyReflection(reflection_level)
    ? await loadMonthlyState({
        supabase,
        userId,
        currentMonth,
        previousMonth,
        timezone,
      })
    : null;

  return {
    profile: {
      id: userId,
      displayName: display_name,
      timezone,
      reflectionLevel: reflection_level,
    },
    weekly,
    monthly,
  };
}
