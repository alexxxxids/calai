import { tz, tzOffset } from '@date-fns/tz';
import { format, getISODay } from 'date-fns';

import { HOURS_PER_DAY, MINUTES_PER_HOUR, MS_PER_DAY, MS_PER_MINUTE } from '@/domain/constants';
import type { Instant, Interval, LocalDate, LocalTime } from '@/domain/types';

// docs/algorithms.md §1. Every function takes the time zone explicitly and never reads the zone
// of the machine: the server runs in UTC, the browser in the user's zone, and both must agree.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const DATE_FORMAT = 'yyyy-MM-dd';
const TIME_FORMAT = 'HH:mm';
const MIDNIGHT: LocalTime = '00:00';
const UTC = 'UTC';

/**
 * Local date + wall-clock time in a zone → the instant it happens.
 * A time skipped by the spring clock change moves forward ('02:30' → 03:30), and a time that
 * happens twice in autumn means its first occurrence. Why not `new TZDate(y, m, d, h, min, zone)`:
 * inside a clock change its result depends on the machine's own zone (a UTC server and a Warsaw
 * laptop return different instants for the autumn '02:30'), so we pick the offset ourselves.
 */
export function zonedToInstant(date: LocalDate, time: LocalTime, timeZone: string): Instant {
  const { year, month, day } = parseLocalDate(date);
  const { hours, minutes } = parseLocalTime(time);
  // The same digits read as if they were UTC. The answer is this minus the zone's offset.
  const wallClock = Date.UTC(year, month - 1, day, hours, minutes);
  // A day earlier and a day later the offset is settled; the two differ only around a clock change.
  const offsetBefore = zoneOffsetMs(timeZone, wallClock - MS_PER_DAY);
  const offsetAfter = zoneOffsetMs(timeZone, wallClock + MS_PER_DAY);

  const withOffsetBefore = wallClock - offsetBefore;
  if (zoneOffsetMs(timeZone, withOffsetBefore) === offsetBefore) {
    return withOffsetBefore; // an ordinary time, or the first occurrence when clocks go back
  }
  const withOffsetAfter = wallClock - offsetAfter;
  if (zoneOffsetMs(timeZone, withOffsetAfter) === offsetAfter) {
    return withOffsetAfter; // an ordinary time later on a day when the clocks changed
  }
  // Neither offset fits: the time was skipped. The old offset moves it forward by the gap.
  return withOffsetBefore;
}

/**
 * Instant → the calendar date it falls on in the zone.
 * Example (Europe/Warsaw): 2026-10-04T22:30Z is already '2026-10-05'.
 */
export function instantToLocalDate(instant: Instant, timeZone: string): LocalDate {
  return formatInZone(instant, DATE_FORMAT, timeZone);
}

/**
 * Instant → the wall-clock time 'HH:mm' it shows in the zone.
 * Example (Europe/Warsaw): 2026-10-05T06:00Z → '08:00'.
 */
export function instantToLocalTime(instant: Instant, timeZone: string): LocalTime {
  return formatInZone(instant, TIME_FORMAT, timeZone);
}

/**
 * The whole local day as an interval [midnight, next midnight).
 * It is 23 hours long when clocks go forward and 25 hours when they go back.
 */
export function localDayRange(date: LocalDate, timeZone: string): Interval {
  return {
    start: zonedToInstant(date, MIDNIGHT, timeZone),
    end: zonedToInstant(addDaysToLocalDate(date, 1), MIDNIGHT, timeZone),
  };
}

/**
 * Calendar arithmetic without hours: ('2026-12-31', 1) → '2027-01-01'.
 * The date is handled as the UTC midnight of that date, and UTC has no clock changes,
 * so there every day is exactly 24 hours long.
 */
export function addDaysToLocalDate(date: LocalDate, days: number): LocalDate {
  return formatUtcDate(utcMidnight(date) + days * MS_PER_DAY);
}

/**
 * ISO day of the week: 1 = Monday … 7 = Sunday. Example: '2026-10-05' → 1.
 */
export function isoWeekday(date: LocalDate): number {
  return getISODay(utcMidnight(date), { in: tz(UTC) });
}

/**
 * The Monday of the week containing the date: '2026-10-08' (Thursday) → '2026-10-05'.
 */
export function weekStart(date: LocalDate): LocalDate {
  return addDaysToLocalDate(date, 1 - isoWeekday(date));
}

/**
 * Converts minutes to milliseconds, the unit of instants.
 */
export function minutesToMs(minutes: number): number {
  return minutes * MS_PER_MINUTE;
}

/** UTC offset of the zone at the instant in ms (Warsaw: +1 h in winter, +2 h in summer). */
function zoneOffsetMs(timeZone: string, instant: Instant): number {
  const offsetMinutes = tzOffset(timeZone, new Date(instant));
  if (Number.isNaN(offsetMinutes)) {
    throw new RangeError(`Unknown time zone: "${timeZone}"`);
  }
  return minutesToMs(offsetMinutes);
}

function formatInZone(instant: Instant, pattern: string, timeZone: string): string {
  // Only to fail with a clear message: for an unknown zone format() would say "Invalid time value".
  zoneOffsetMs(timeZone, instant);
  // Reading an instant in a zone is safe with @date-fns/tz: it depends on the zone, not the machine.
  return format(instant, pattern, { in: tz(timeZone) });
}

function utcMidnight(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return Date.UTC(year, month - 1, day);
}

function formatUtcDate(instant: Instant): LocalDate {
  return format(instant, DATE_FORMAT, { in: tz(UTC) });
}

/** Splits 'YYYY-MM-DD' into numbers and rejects dates that do not exist, like '2026-02-30'. */
function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } {
  const match = DATE_PATTERN.exec(date);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  const day = Number(match?.[3]);
  const utc = Date.UTC(year, month - 1, day);
  // Date.UTC silently turns 2026-02-30 into 2026-03-02, so a real date must survive the round trip.
  const isValid = !Number.isNaN(utc) && formatUtcDate(utc) === date;
  if (!isValid) {
    throw new RangeError(`Invalid date "${date}": expected an existing day as YYYY-MM-DD`);
  }
  return { year, month, day };
}

/** Splits 'HH:mm' into numbers and rejects impossible times like '24:00' or '12:60'. */
function parseLocalTime(time: LocalTime): { hours: number; minutes: number } {
  const match = TIME_PATTERN.exec(time);
  const hours = Number(match?.[1]);
  const minutes = Number(match?.[2]);
  // A failed match gives NaN, and every comparison with NaN is false.
  const isValid = hours < HOURS_PER_DAY && minutes < MINUTES_PER_HOUR;
  if (!isValid) {
    throw new RangeError(`Invalid time "${time}": expected HH:mm between 00:00 and 23:59`);
  }
  return { hours, minutes };
}
