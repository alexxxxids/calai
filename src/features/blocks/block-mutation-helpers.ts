import 'server-only';

import { MS_PER_DAY, MS_PER_MINUTE } from '@/domain/constants';
import {
  effectiveEnergyLimit,
  stressMultiplier,
  type DailyMetrics,
  type WeeklyScores,
} from '@/domain/energy';
import { paceSample } from '@/domain/pace';
import { addDaysToLocalDate, instantToLocalDate, localDayRange } from '@/domain/time';
import type { LocalDate } from '@/domain/types';
import type { ServerSupabase } from '@/lib/supabase/server';
import type { ReflectionLevel } from '@/types/db';

import { calculateDayEnergyPoints, checkDayLoadWarning } from './load-warning';
import type { WarningLoadResult } from './types';

export { calculateTaskPaceForTask } from './pace-helpers';

const REFLECTION_MAX_AGE_DAYS = 14;
const SEVEN_DAYS_COUNT = 7;
const SEVEN_DAYS_MS = SEVEN_DAYS_COUNT * MS_PER_DAY;
const DEFAULT_BLOCK_ENERGY = 0;

export interface OverlapRange {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly excludeBlockId?: string;
}

export interface NewBlockLoad {
  readonly durationMinutes: number;
  readonly energy: number;
  readonly excludeBlockId?: string;
}

export interface ClosedBlockMetricRow {
  readonly status: 'done' | 'missed';
  readonly work_minutes: number;
  readonly actual_minutes: number | null;
  readonly closed_at: string | null;
}

interface UserProfileData {
  readonly timezone: string;
  readonly daily_energy_limit: number;
  readonly reflection_level: ReflectionLevel;
}

interface RawDayBlock {
  readonly starts_at: string;
  readonly ends_at: string;
  readonly tasks: { readonly task_types: { readonly energy: number } | null } | null;
}

export async function deleteOverlappingUnpinnedBlocks(
  supabase: ServerSupabase,
  userId: string,
  range: OverlapRange,
): Promise<void>;
export async function deleteOverlappingUnpinnedBlocks(
  supabase: ServerSupabase,
  userId: string,
  startsAtIso: string,
  endsAtIso: string,
): Promise<void>;
export async function deleteOverlappingUnpinnedBlocks(
  supabase: ServerSupabase,
  userId: string,
  startsAtOrRange: string | OverlapRange,
  endsAtIso?: string,
): Promise<void> {
  const startsAt = typeof startsAtOrRange === 'string' ? startsAtOrRange : startsAtOrRange.startsAt;
  const endsAt = typeof startsAtOrRange === 'string' ? (endsAtIso ?? '') : startsAtOrRange.endsAt;
  const excludeBlockId =
    typeof startsAtOrRange === 'string' ? undefined : startsAtOrRange.excludeBlockId;

  let query = supabase
    .from('blocks')
    .delete()
    .eq('user_id', userId)
    .eq('status', 'planned')
    .eq('pinned', false)
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt);

  if (excludeBlockId) {
    query = query.neq('id', excludeBlockId);
  }

  const { error } = await query;
  if (error) {
    throw new Error(`Błąd usuwania nachodzących bloków: ${error.message}`);
  }
}

export function dailyMetricsFromClosedBlocks(
  blocks: readonly ClosedBlockMetricRow[],
): DailyMetrics {
  let done = 0;
  let missed = 0;
  const samples: number[] = [];

  for (const block of blocks) {
    if (block.status === 'done') {
      done += 1;
      if (block.work_minutes > 0 && block.actual_minutes !== null && block.actual_minutes > 0) {
        samples.push(paceSample(block.actual_minutes, block.work_minutes));
      }
    } else if (block.status === 'missed') {
      missed += 1;
    }
  }

  const meanPaceSample =
    samples.length > 0 ? samples.reduce((sum, s) => sum + s, 0) / samples.length : null;

  return { done, missed, meanPaceSample };
}

async function fetchUserProfile(supabase: ServerSupabase, userId: string): Promise<UserProfileData> {
  const { data, error } = await supabase
    .from('profiles')
    .select('timezone, daily_energy_limit, reflection_level')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error(`Nie znaleziono profilu użytkownika: ${error?.message ?? 'brak danych'}`);
  }

  return data as UserProfileData;
}

interface DayEnergyQueryOptions {
  readonly dayStartIso: string;
  readonly dayEndIso: string;
  readonly excludeBlockId?: string;
}

async function fetchDayEnergyPoints(
  supabase: ServerSupabase,
  userId: string,
  options: DayEnergyQueryOptions,
): Promise<number> {
  let query = supabase
    .from('blocks')
    .select(`
      starts_at,
      ends_at,
      tasks (
        task_types (
          energy
        )
      )
    `)
    .eq('user_id', userId)
    .neq('status', 'missed')
    .gte('starts_at', options.dayStartIso)
    .lt('starts_at', options.dayEndIso);

  if (options.excludeBlockId) {
    query = query.neq('id', options.excludeBlockId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Błąd pobierania bloków dnia: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as readonly RawDayBlock[];
  const blocks = rows.map((row) => ({
    durationMinutes: Math.round(
      (Date.parse(row.ends_at) - Date.parse(row.starts_at)) / MS_PER_MINUTE,
    ),
    energy: row.tasks?.task_types?.energy ?? DEFAULT_BLOCK_ENERGY,
  }));

  return calculateDayEnergyPoints(blocks);
}

function extractWeeklyScores(
  reflection: {
    readonly week_start: string;
    readonly fatigue: number;
    readonly stress: number;
    readonly focus: number;
    readonly distractions: number;
  } | null,
  level: ReflectionLevel,
  todayDate: LocalDate,
): WeeklyScores | null {
  if (reflection === null || level === 'basic') {
    return null;
  }
  const cutoffDate = addDaysToLocalDate(reflection.week_start, REFLECTION_MAX_AGE_DAYS);
  if (cutoffDate < todayDate) {
    return null;
  }
  return {
    fatigue: reflection.fatigue,
    stress: reflection.stress,
    focus: reflection.focus,
    distractions: reflection.distractions,
  };
}

async function resolveStressMultiplier(
  supabase: ServerSupabase,
  userId: string,
  profile: UserProfileData,
  context: { readonly instant: number; readonly localDate: LocalDate },
): Promise<number> {
  const { data: reflection, error: reflectionError } = await supabase
    .from('weekly_reflections')
    .select('week_start, fatigue, stress, focus, distractions')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reflectionError) {
    throw new Error(`Błąd pobierania refleksji tygodniowej: ${reflectionError.message}`);
  }

  const weekly = extractWeeklyScores(reflection, profile.reflection_level, context.localDate);
  if (weekly !== null) {
    return stressMultiplier({ weekly, daily: { done: 0, missed: 0, meanPaceSample: null } });
  }

  const sevenDaysAgoIso = new Date(context.instant - SEVEN_DAYS_MS).toISOString();
  const { data: closedBlocks, error: closedError } = await supabase
    .from('blocks')
    .select('status, work_minutes, actual_minutes, closed_at')
    .eq('user_id', userId)
    .in('status', ['done', 'missed'])
    .gte('closed_at', sevenDaysAgoIso);

  if (closedError) {
    throw new Error(`Błąd pobierania zamkniętych bloków: ${closedError.message}`);
  }

  const daily = dailyMetricsFromClosedBlocks(
    (closedBlocks ?? []) as unknown as readonly ClosedBlockMetricRow[],
  );
  return stressMultiplier({ weekly: null, daily });
}

export async function evaluateDayLoadWarning(
  supabase: ServerSupabase,
  userId: string,
  startsAtIso: string,
  newBlock: NewBlockLoad,
): Promise<WarningLoadResult> {
  const profile = await fetchUserProfile(supabase, userId);
  const instant = Date.parse(startsAtIso);
  const localDate = instantToLocalDate(instant, profile.timezone);
  const dayRange = localDayRange(localDate, profile.timezone);

  const existingPoints = await fetchDayEnergyPoints(supabase, userId, {
    dayStartIso: new Date(dayRange.start).toISOString(),
    dayEndIso: new Date(dayRange.end).toISOString(),
    excludeBlockId: newBlock.excludeBlockId,
  });

  const newBlockPoints = calculateDayEnergyPoints([newBlock]);
  const totalDayPoints = existingPoints + newBlockPoints;

  const multiplier = await resolveStressMultiplier(supabase, userId, profile, {
    instant,
    localDate,
  });

  const effectiveLimit = effectiveEnergyLimit(profile.daily_energy_limit, multiplier);
  return checkDayLoadWarning(totalDayPoints, effectiveLimit);
}
