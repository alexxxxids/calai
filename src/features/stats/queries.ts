import 'server-only';
import type { ServerSupabase } from '@/lib/supabase/server';
import { getProfile } from '@/features/profile/queries';
import {
  aggregateDailyLoadPoints,
  aggregateOneOffTypes,
  calculateCompletionRateSummary,
  calculateStatsDateRange,
  formatFatigueTrend,
  type WeeklyReflectionTrendRow,
} from './rules';
import {
  DEFAULT_BLOCK_ENERGY,
  MAX_FATIGUE_WEEKS_LIMIT,
  type DailyLoadItem,
  type FatigueTrendItem,
  type RawBlockWithEnergy,
  type StatsOverview,
  type StatsRange,
  type TypeStatItem,
} from './types';

interface RawDayBlockRow {
  readonly starts_at: string;
  readonly ends_at: string;
  readonly status: 'planned' | 'done' | 'missed';
  readonly actual_minutes: number | null;
  readonly tasks: {
    readonly task_types: {
      readonly energy: number;
    } | null;
  } | null;
}

export interface GetDailyLoadParams {
  readonly supabase: ServerSupabase;
  readonly userId: string;
  readonly fromIso: string;
  readonly toIso: string;
  readonly timeZone: string;
  readonly rangeDays: StatsRange;
  readonly now: Date;
  readonly effectiveLimit: number;
}

/**
 * Fetches plan vs actual statistics per task type using the SQL RPC type_stats.
 */
export async function getTypeStats(
  supabase: ServerSupabase,
  fromIso: string,
  toIso: string,
): Promise<TypeStatItem[]> {
  const result = await supabase.rpc('type_stats', {
    p_from: fromIso,
    p_to: toIso,
  });

  if (result.error) {
    throw result.error;
  }

  return aggregateOneOffTypes(result.data ?? []);
}

/**
 * Fetches daily load points across the specified date range.
 */
export async function getDailyLoad(params: GetDailyLoadParams): Promise<DailyLoadItem[]> {
  const { supabase, userId, fromIso, toIso, timeZone, rangeDays, now, effectiveLimit } = params;

  const { data, error } = await supabase
    .from('blocks')
    .select(`
      starts_at,
      ends_at,
      status,
      actual_minutes,
      tasks (
        task_types (
          energy
        )
      )
    `)
    .eq('user_id', userId)
    .neq('status', 'missed')
    .gte('starts_at', fromIso)
    .lt('starts_at', toIso);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as readonly RawDayBlockRow[];
  const rawBlocks: RawBlockWithEnergy[] = rows.map((row) => ({
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    status: row.status,
    actual_minutes: row.actual_minutes,
    energy: row.tasks?.task_types?.energy ?? DEFAULT_BLOCK_ENERGY,
  }));

  return aggregateDailyLoadPoints({
    blocks: rawBlocks,
    rangeDays,
    now,
    timeZone,
    effectiveLimit,
  });
}

/**
 * Fetches recent weekly reflections to compute the fatigue and stress trend (H-5).
 * Selects up to 12 most recent weeks, sorted chronologically.
 */
export async function getFatigueTrend(
  supabase: ServerSupabase,
  userId: string,
): Promise<FatigueTrendItem[]> {
  const { data, error } = await supabase
    .from('weekly_reflections')
    .select('week_start, fatigue, stress, focus, distractions')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(MAX_FATIGUE_WEEKS_LIMIT);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as readonly WeeklyReflectionTrendRow[];
  return formatFatigueTrend(rows);
}

/**
 * Orchestrates fetching full statistics overview for the stats page.
 */
export async function getStatsOverview(
  supabase: ServerSupabase,
  userId: string,
  range: StatsRange,
  now: Date = new Date(),
): Promise<StatsOverview> {
  const profile = await getProfile(supabase, userId);
  if (!profile) {
    throw new Error('Nie znaleziono profilu użytkownika');
  }

  const dateRange = calculateStatsDateRange(range, now, profile.timezone);

  const [typeStats, dailyLoad, fatigueTrend] = await Promise.all([
    getTypeStats(supabase, dateRange.fromIso, dateRange.toIso),
    getDailyLoad({
      supabase,
      userId,
      fromIso: dateRange.fromIso,
      toIso: dateRange.toIso,
      timeZone: profile.timezone,
      rangeDays: range,
      now,
      effectiveLimit: profile.daily_energy_limit,
    }),
    getFatigueTrend(supabase, userId),
  ]);

  const completionRate = calculateCompletionRateSummary(typeStats);

  return {
    range,
    typeStats,
    dailyLoad,
    fatigueTrend,
    completionRate,
    effectiveLimit: profile.daily_energy_limit,
    reflectionLevel: profile.reflection_level,
  };
}
