import { MINUTES_PER_HOUR, MS_PER_MINUTE } from '@/domain/constants';
import { instantToLocalDate, instantToLocalTime, isoWeekday } from '@/domain/time';
import type { Instant, LocalTime } from '@/domain/types';

export const UPCOMING_WINDOW_START_MINUTES = 5;
export const UPCOMING_WINDOW_END_MINUTES = 15;
export const CRON_INTERVAL_MINUTES = 5;
export const SUNDAY_ISO_DAY = 7;
export const SUNDAY_REFLECTION_HOUR = 19;

const UPCOMING_WINDOW_START_MS = UPCOMING_WINDOW_START_MINUTES * MS_PER_MINUTE;
const UPCOMING_WINDOW_END_MS = UPCOMING_WINDOW_END_MINUTES * MS_PER_MINUTE;
const SUNDAY_TARGET_START_MINUTES = SUNDAY_REFLECTION_HOUR * MINUTES_PER_HOUR;

/**
 * Checks whether a block's start instant falls in the semi-open interval [now + 5m, now + 15m).
 */
export function isWithinUpcomingWindow(nowMs: Instant, blockStartMs: Instant): boolean {
  return (
    blockStartMs >= nowMs + UPCOMING_WINDOW_START_MS &&
    blockStartMs < nowMs + UPCOMING_WINDOW_END_MS
  );
}

function parseTimeToDayMinutes(timeStr: LocalTime): number {
  const parts = timeStr.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  return hours * MINUTES_PER_HOUR + minutes;
}

/**
 * Checks if current instant matches user's local end-of-day window [dayEnd, dayEnd + 5m).
 */
export function isEndOfDayWindow(nowMs: Instant, timezone: string, dayEnd: LocalTime): boolean {
  const localTime = instantToLocalTime(nowMs, timezone);
  const curMinutes = parseTimeToDayMinutes(localTime);
  const endMinutes = parseTimeToDayMinutes(dayEnd);

  return curMinutes >= endMinutes && curMinutes < endMinutes + CRON_INTERVAL_MINUTES;
}

/**
 * Checks if current instant matches Sunday 19:00 window [19:00, 19:05) in user's timezone.
 */
export function isSundayReflectionWindow(nowMs: Instant, timezone: string): boolean {
  const localDate = instantToLocalDate(nowMs, timezone);
  if (isoWeekday(localDate) !== SUNDAY_ISO_DAY) {
    return false;
  }

  const localTime = instantToLocalTime(nowMs, timezone);
  const curMinutes = parseTimeToDayMinutes(localTime);

  return (
    curMinutes >= SUNDAY_TARGET_START_MINUTES &&
    curMinutes < SUNDAY_TARGET_START_MINUTES + CRON_INTERVAL_MINUTES
  );
}
