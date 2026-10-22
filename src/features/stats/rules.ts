import { energyPoints } from '@/domain/energy';
import {
  addDaysToLocalDate,
  instantToLocalDate,
  isoWeekday,
  zonedToInstant,
} from '@/domain/time';
import {
  DAYS_OFFSET_ONE,
  DEFAULT_ONE_OFF_COLOR,
  MS_PER_MINUTE,
  ONE_OFF_AGGREGATE_ID,
  ONE_OFF_AGGREGATE_NAME,
  PERCENTAGE_FACTOR,
  type AggregateDailyLoadParams,
  type CompletionRateSummary,
  type DailyLoadItem,
  type FatigueTrendItem,
  type StatsDateRange,
  type StatsRange,
  type TypeStatItem,
  type TypeStatsRow,
} from './types';

const MIDNIGHT = '00:00';
const DECIMAL_ROUNDING_FACTOR = 10;

/**
 * Calculates start and end boundaries for the stats range in the user's timezone.
 * Returns local date strings and exact ISO moments [fromIso, toIso) covering rangeDays.
 */
export function calculateStatsDateRange(
  rangeDays: StatsRange,
  now: Date,
  timeZone: string,
): StatsDateRange {
  const toLocalDate = instantToLocalDate(now.getTime(), timeZone);
  const fromLocalDate = addDaysToLocalDate(toLocalDate, -(rangeDays - DAYS_OFFSET_ONE));

  const fromInstant = zonedToInstant(fromLocalDate, MIDNIGHT, timeZone);
  const nextDayAfterTo = addDaysToLocalDate(toLocalDate, DAYS_OFFSET_ONE);
  const toInstant = zonedToInstant(nextDayAfterTo, MIDNIGHT, timeZone);

  return {
    fromLocalDate,
    toLocalDate,
    fromIso: new Date(fromInstant).toISOString(),
    toIso: new Date(toInstant).toISOString(),
  };
}

function toRegularStatItem(row: TypeStatsRow): TypeStatItem {
  const closed = row.done_blocks + row.missed_blocks;
  const rate =
    closed > 0 ? Math.round((row.done_blocks / closed) * PERCENTAGE_FACTOR) : 0;
  return {
    typeId: row.type_id,
    typeName: row.type_name,
    color: row.color,
    isOneOff: false,
    plannedMinutes: row.planned_minutes,
    actualMinutes: row.actual_minutes,
    doneBlocks: row.done_blocks,
    missedBlocks: row.missed_blocks,
    completionRate: rate,
  };
}

function toOneOffAggregateItem(
  planned: number,
  actual: number,
  done: number,
  missed: number,
): TypeStatItem {
  const closed = done + missed;
  const rate =
    closed > 0 ? Math.round((done / closed) * PERCENTAGE_FACTOR) : 0;
  return {
    typeId: ONE_OFF_AGGREGATE_ID,
    typeName: ONE_OFF_AGGREGATE_NAME,
    color: DEFAULT_ONE_OFF_COLOR,
    isOneOff: true,
    plannedMinutes: planned,
    actualMinutes: actual,
    doneBlocks: done,
    missedBlocks: missed,
    completionRate: rate,
  };
}

/**
 * Aggregates one-off task types into a single "Jednorazowe" group (FR-21).
 * Regular catalog types are preserved and sorted by plannedMinutes descending.
 */
export function aggregateOneOffTypes(rows: readonly TypeStatsRow[]): TypeStatItem[] {
  const regularItems: TypeStatItem[] = [];
  let oneOffPlanned = 0;
  let oneOffActual = 0;
  let oneOffDone = 0;
  let oneOffMissed = 0;
  let hasOneOff = false;

  for (const row of rows) {
    if (row.is_one_off) {
      hasOneOff = true;
      oneOffPlanned += row.planned_minutes;
      oneOffActual += row.actual_minutes;
      oneOffDone += row.done_blocks;
      oneOffMissed += row.missed_blocks;
    } else {
      regularItems.push(toRegularStatItem(row));
    }
  }

  regularItems.sort((a, b) => {
    if (b.plannedMinutes !== a.plannedMinutes) {
      return b.plannedMinutes - a.plannedMinutes;
    }
    return a.typeName.localeCompare(b.typeName, 'pl');
  });

  if (hasOneOff) {
    regularItems.push(
      toOneOffAggregateItem(oneOffPlanned, oneOffActual, oneOffDone, oneOffMissed),
    );
  }

  return regularItems;
}

/**
 * Calculates global completion rate metrics.
 * When there are no closed blocks, percentage is null.
 */
export function calculateCompletionRateSummary(
  items: readonly TypeStatItem[],
): CompletionRateSummary {
  let totalDone = 0;
  let totalMissed = 0;

  for (const item of items) {
    totalDone += item.doneBlocks;
    totalMissed += item.missedBlocks;
  }

  const totalClosed = totalDone + totalMissed;
  const percentage =
    totalClosed > 0
      ? Math.round((totalDone / totalClosed) * PERCENTAGE_FACTOR)
      : null;

  return {
    totalDone,
    totalMissed,
    totalClosed,
    percentage,
  };
}

/**
 * Aggregates load points across continuous sequence of local days (H-1, H-4).
 * Single options object prevents ESLint max-params error.
 * Every day in the range is included without skipping.
 */
export function aggregateDailyLoadPoints(
  params: AggregateDailyLoadParams,
): DailyLoadItem[] {
  const { blocks, rangeDays, now, timeZone, effectiveLimit } = params;
  const range = calculateStatsDateRange(rangeDays, now, timeZone);

  const pointsByDate = new Map<string, number>();

  for (const block of blocks) {
    const startsAtMs = Date.parse(block.starts_at);
    const localDate = instantToLocalDate(startsAtMs, timeZone);

    const durationMinutes =
      block.status === 'done' &&
      block.actual_minutes !== null &&
      block.actual_minutes > 0
        ? block.actual_minutes
        : Math.round((Date.parse(block.ends_at) - startsAtMs) / MS_PER_MINUTE);

    const loadPoints = energyPoints(durationMinutes, block.energy);
    const existing = pointsByDate.get(localDate) ?? 0;
    pointsByDate.set(localDate, existing + loadPoints);
  }

  const result: DailyLoadItem[] = [];
  let currentDate = range.fromLocalDate;

  for (let i = 0; i < rangeDays; i += 1) {
    const rawPoints = pointsByDate.get(currentDate) ?? 0;
    const roundedPoints =
      Math.round(rawPoints * DECIMAL_ROUNDING_FACTOR) / DECIMAL_ROUNDING_FACTOR;

    result.push({
      date: currentDate,
      points: roundedPoints,
      limit: effectiveLimit,
      dayOfWeek: isoWeekday(currentDate),
    });

    currentDate = addDaysToLocalDate(currentDate, DAYS_OFFSET_ONE);
  }

  return result;
}

export interface WeeklyReflectionTrendRow {
  readonly week_start: string;
  readonly fatigue: number;
  readonly stress: number;
  readonly focus: number;
  readonly distractions: number;
}

/**
 * Sorts and transforms reflection rows into fatigue and stress trend points.
 */
export function formatFatigueTrend(
  reflections: readonly WeeklyReflectionTrendRow[],
): FatigueTrendItem[] {
  const sorted = [...reflections].sort((a, b) =>
    a.week_start.localeCompare(b.week_start),
  );

  return sorted.map((row) => ({
    weekStart: row.week_start,
    fatigue: row.fatigue,
    stress: row.stress,
    focus: row.focus,
    distractions: row.distractions,
  }));
}
