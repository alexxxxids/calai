import { overlaps } from '@/domain/intervals';
import { addDaysToLocalDate, instantToLocalDate, isoWeekday, zonedToInstant } from '@/domain/time';
import type { Interval, LocalDate, LocalTime } from '@/domain/types';

/**
 * A weekly event stored as a rule in local time: "Tuesdays 08:00–08:45 in the user's zone".
 * Stored in UTC it would move by an hour after every clock change.
 */
export interface WeeklyRule {
  /** ISO day of the week: 1 = Monday … 7 = Sunday. */
  readonly weekday: number;
  readonly startTime: LocalTime;
  /** Later than startTime on the same day. */
  readonly endTime: LocalTime;
  readonly validFrom: LocalDate;
  /** Inclusive; null means "until further notice". */
  readonly validUntil: LocalDate | null;
}

/**
 * All occurrences of the rule that overlap `range`, sorted by start (docs/algorithms.md §3).
 * Each occurrence is built from the local date and times, so a lesson at 08:00 stays at 08:00
 * after a clock change: 06:00Z in October, 07:00Z in November for Europe/Warsaw.
 */
export function expandWeekly(rule: WeeklyRule, range: Interval, timeZone: string): Interval[] {
  const firstDate = laterDate(rule.validFrom, instantToLocalDate(range.start, timeZone));
  const rangeLastDate = instantToLocalDate(range.end, timeZone);
  const lastDate =
    rule.validUntil === null ? rangeLastDate : earlierDate(rule.validUntil, rangeLastDate);

  const occurrences: Interval[] = [];
  // 'YYYY-MM-DD' strings sort like the dates they name, so `<=` compares dates correctly.
  for (let date = firstDate; date <= lastDate; date = addDaysToLocalDate(date, 1)) {
    if (isoWeekday(date) !== rule.weekday) {
      continue;
    }
    const occurrence = {
      start: zonedToInstant(date, rule.startTime, timeZone),
      end: zonedToInstant(date, rule.endTime, timeZone),
    };
    // An event lying wholly inside the hour skipped in spring would end before it starts: it does not happen.
    if (occurrence.end > occurrence.start && overlaps(occurrence, range)) {
      occurrences.push(occurrence);
    }
  }
  return occurrences;
}

function laterDate(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}

function earlierDate(a: LocalDate, b: LocalDate): LocalDate {
  return a < b ? a : b;
}
