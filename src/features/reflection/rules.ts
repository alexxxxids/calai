import type { ReflectionLevel } from '@/types/db';
import {
  addDaysToLocalDate,
  instantToLocalDate,
  isoWeekday,
  weekStart,
  zonedToInstant,
} from '@/domain/time';

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-01$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DECEMBER = 12;
const JANUARY = 1;
const DAYS_IN_WEEK = 7;
const MONDAY_ISO_DAY = 1;
const MONTH_PADDING = 2;

export interface TypeStatsRow {
  readonly type_id: string;
  readonly type_name: string;
  readonly color: string;
  readonly is_one_off: boolean;
  readonly planned_minutes: number;
  readonly actual_minutes: number;
  readonly done_blocks: number;
  readonly missed_blocks: number;
}

export interface DisplayTypeStat {
  readonly typeId: string;
  readonly typeName: string;
  readonly color: string;
  readonly isOneOff: boolean;
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly doneBlocks: number;
  readonly missedBlocks: number;
}

/**
 * Returns Monday (ISO 8601) of the current week in the specified time zone.
 */
export function getCurrentWeekStart(now: Date, timeZone: string): string {
  const localDate = instantToLocalDate(now.getTime(), timeZone);
  return weekStart(localDate);
}

/**
 * Returns Monday of the previous week in the specified time zone.
 */
export function getPreviousWeekStart(now: Date, timeZone: string): string {
  const currentWeek = getCurrentWeekStart(now, timeZone);
  return addDaysToLocalDate(currentWeek, -DAYS_IN_WEEK);
}

/**
 * Checks whether the given weekStart string can be filled by the user.
 * Per spec FR-100: only the current week and previous week are permitted.
 * Also strictly verifies that the date is an ISO Monday.
 */
export function isAllowedWeek(weekStartInput: string, now: Date, timeZone: string): boolean {
  if (!DATE_PATTERN.test(weekStartInput)) {
    return false;
  }
  try {
    if (isoWeekday(weekStartInput) !== MONDAY_ISO_DAY) {
      return false;
    }
  } catch {
    return false;
  }

  const current = getCurrentWeekStart(now, timeZone);
  const previous = getPreviousWeekStart(now, timeZone);
  return weekStartInput === current || weekStartInput === previous;
}

/**
 * Returns 'YYYY-MM-01' representing the first day of the current month in timeZone.
 */
export function getCurrentMonthStart(now: Date, timeZone: string): string {
  const localDate = instantToLocalDate(now.getTime(), timeZone);
  const match = DATE_PATTERN.exec(localDate);
  if (!match) {
    throw new RangeError(`Invalid local date: "${localDate}"`);
  }
  return `${match[1]}-${match[2]}-01`;
}

/**
 * Pure string operation to get the start of the next month ('YYYY-MM-01').
 */
export function getNextMonthStart(monthStart: string): string {
  const match = MONTH_PATTERN.exec(monthStart);
  if (!match) {
    throw new RangeError(`Invalid month format "${monthStart}", expected YYYY-MM-01`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);

  const nextYear = month === DECEMBER ? year + 1 : year;
  const nextMonth = month === DECEMBER ? JANUARY : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(MONTH_PADDING, '0')}-01`;
}

/**
 * Pure string operation to get the start of the previous month ('YYYY-MM-01').
 */
export function getPreviousMonthStart(monthStart: string): string {
  const match = MONTH_PATTERN.exec(monthStart);
  if (!match) {
    throw new RangeError(`Invalid month format "${monthStart}", expected YYYY-MM-01`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);

  const prevYear = month === JANUARY ? year - 1 : year;
  const prevMonth = month === JANUARY ? DECEMBER : month - 1;
  return `${prevYear}-${String(prevMonth).padStart(MONTH_PADDING, '0')}-01`;
}

/**
 * Verifies that the month input is a valid YYYY-MM-01 date and strictly
 * either the current or previous month in the user's timezone (FR-101).
 */
export function isAllowedMonth(monthInput: string, now: Date, timeZone: string): boolean {
  if (!MONTH_PATTERN.test(monthInput)) {
    return false;
  }
  const currentMonth = getCurrentMonthStart(now, timeZone);
  const previousMonth = getPreviousMonthStart(currentMonth);
  return monthInput === currentMonth || monthInput === previousMonth;
}

/**
 * Weekly questionnaire is available for analytic and strategic levels (FR-11, FR-100).
 */
export function canAccessWeeklyReflection(level: ReflectionLevel): boolean {
  return level === 'analytic' || level === 'strategic';
}

/**
 * Monthly review is available only for strategic level (FR-11, FR-101).
 */
export function canAccessMonthlyReflection(level: ReflectionLevel): boolean {
  return level === 'strategic';
}

/**
 * Computes exact ISO timestamps [fromIso, toIso) in user's timeZone for RPC type_stats.
 * Accounts for DST transitions (e.g. Warsaw autumn transition).
 */
export function getMonthInterval(monthStart: string, timeZone: string): { fromIso: string; toIso: string } {
  const fromInstant = zonedToInstant(monthStart, '00:00', timeZone);
  const nextMonth = getNextMonthStart(monthStart);
  const toInstant = zonedToInstant(nextMonth, '00:00', timeZone);

  return {
    fromIso: new Date(fromInstant).toISOString(),
    toIso: new Date(toInstant).toISOString(),
  };
}

/**
 * Aggregates task type statistics for monthly review (FR-21).
 * Regular catalog types are preserved. All one-off types (is_one_off = true)
 * are aggregated into a single line "Jednorazowe".
 */
export function aggregateTypeStats(rows: readonly TypeStatsRow[]): DisplayTypeStat[] {
  const regularStats: DisplayTypeStat[] = [];
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
      regularStats.push({
        typeId: row.type_id,
        typeName: row.type_name,
        color: row.color,
        isOneOff: false,
        plannedMinutes: row.planned_minutes,
        actualMinutes: row.actual_minutes,
        doneBlocks: row.done_blocks,
        missedBlocks: row.missed_blocks,
      });
    }
  }

  if (hasOneOff) {
    regularStats.push({
      typeId: 'one-off-aggregate',
      typeName: 'Jednorazowe',
      color: '#888888',
      isOneOff: true,
      plannedMinutes: oneOffPlanned,
      actualMinutes: oneOffActual,
      doneBlocks: oneOffDone,
      missedBlocks: oneOffMissed,
    });
  }

  return regularStats;
}
