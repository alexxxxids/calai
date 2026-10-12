import { normalizeSessionMinutes } from '@/domain/scheduler';
import { addDaysToLocalDate, isoWeekday, weekStart } from '@/domain/time';
import type { LocalDate } from '@/domain/types';
import {
  MAX_ESTIMATE_MINUTES,
  MAX_NOTES_LENGTH,
  totalWorkMinutes,
  type Decomposition,
  type DecompositionDraft,
  type Timetable,
  type TimetableDraft,
  type Topic,
} from '@/features/ai/schemas';

// Turning a checked model answer into a draft for the user, and a confirmed draft into data.
// docs/algorithms.md §7. Pure functions, unit-tested.

/** Estimates are kept in 5-minute steps: the model's minutes are guesses, not measurements. */
const ESTIMATE_STEP = 5;
const DAYS_PER_WEEK = 7;
const FRIDAY = 5;
/** Polish schools end classes on the first Friday after 20 June (the rule of the Ministry). */
const SCHOOL_YEAR_END_SEARCH_FROM = '06-21';
const ISO_YEAR_STRING_LENGTH = 4;

/** Σ of the topics' minutes rounded to 5: the task's estimate_minutes. */
export function estimateFromTopics(topics: readonly Topic[]): number {
  return Math.round(totalWorkMinutes(topics) / ESTIMATE_STEP) * ESTIMATE_STEP;
}

/**
 * The model's decomposition → the draft shown to the user. The session length goes through
 * the planner's own normalizeSessionMinutes, so the draft and the plan agree (50 → 45).
 */
export function toDecompositionDraft(output: Decomposition): DecompositionDraft {
  const estimateMinutes = estimateFromTopics(output.topics);
  const warnings =
    estimateMinutes > MAX_ESTIMATE_MINUTES
      ? [
          ...output.warnings,
          'Łączny czas tematów przekracza 100 godzin. Skróć lub usuń część tematów przed zapisaniem.',
        ]
      : output.warnings;

  return {
    summary: output.summary,
    sessionMinutes: normalizeSessionMinutes(output.sessionMinutes),
    estimateMinutes,
    topics: output.topics,
    warnings,
  };
}

/**
 * The topics as the task's notes: '1. Funkcja kwadratowa — 45 min', one per line.
 * tasks.notes holds 2000 characters, so a very long list is cut at a whole line and marked '…'.
 */
export function topicsToNotes(topics: readonly Topic[]): string {
  const lines = ['Tematy:', ...topics.map((topic, index) => `${index + 1}. ${topic.title} — ${topic.workMinutes} min`)];
  const ellipsis = '…';
  let notes = lines.join('\n');
  while (notes.length > MAX_NOTES_LENGTH) {
    lines.pop();
    notes = [...lines, ellipsis].join('\n');
  }
  return notes;
}

/** The model's timetable → the draft, valid from the nearest Monday to the end of the school year. */
export function toTimetableDraft(output: Timetable, today: LocalDate): TimetableDraft {
  const validFrom = nearestMonday(today);
  return {
    events: output.events,
    warnings: output.warnings,
    validFrom,
    validUntil: schoolYearEnd(validFrom),
  };
}

/** The date itself when it is a Monday, otherwise the next Monday: a new timetable starts a week. */
export function nearestMonday(date: LocalDate): LocalDate {
  return isoWeekday(date) === 1 ? date : addDaysToLocalDate(weekStart(date), DAYS_PER_WEEK);
}

/**
 * The last day of classes of the school year that contains `date`: the first Friday after
 * 20 June. After that day the school year that counts is the next one.
 * Examples: '2026-09-28' → '2027-06-25', '2027-06-26' → '2028-06-23'.
 */
export function schoolYearEnd(date: LocalDate): LocalDate {
  const year = Number(date.slice(0, ISO_YEAR_STRING_LENGTH));
  const thisYearEnd = firstFridayFrom(`${year}-${SCHOOL_YEAR_END_SEARCH_FROM}`);
  return date <= thisYearEnd ? thisYearEnd : firstFridayFrom(`${year + 1}-${SCHOOL_YEAR_END_SEARCH_FROM}`);
}

function firstFridayFrom(date: LocalDate): LocalDate {
  const daysToFriday = (FRIDAY - isoWeekday(date) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return addDaysToLocalDate(date, daysToFriday);
}
