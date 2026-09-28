import { MS_PER_MINUTE } from '@/domain/constants';
import type { Interval } from '@/domain/types';

// docs/algorithms.md §2. Intervals are half-open [start, end): touching is not overlapping.

/**
 * True when the two intervals share at least one moment.
 * 10:00–11:00 and 11:00–12:00 only touch, so they do not overlap.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Sorts by start and glues together intervals that overlap or touch.
 * The result has no overlaps and is sorted; the input is not changed.
 */
export function mergeIntervals(list: readonly Interval[]): Interval[] {
  const merged: Interval[] = [];
  for (const interval of [...list].sort(compareByStart)) {
    const last = merged.at(-1);
    if (last !== undefined && interval.start <= last.end) {
      // Overlapping or touching: extend the last interval instead of adding a new one.
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, interval.end) };
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

/**
 * The parts of `base` not covered by any interval from `busy`, sorted by start.
 * Example: [8:00, 22:00) minus [10:00, 11:00) and [10:30, 12:00) = [8:00, 10:00) and [12:00, 22:00).
 */
export function subtractIntervals(base: Interval, busy: readonly Interval[]): Interval[] {
  const free: Interval[] = [];
  // `cursor` walks from left to right: everything before it is already decided.
  let cursor = base.start;
  for (const taken of mergeIntervals(busy)) {
    if (taken.end <= cursor || taken.start >= base.end) {
      continue; // entirely before the cursor or entirely after the base
    }
    if (taken.start > cursor) {
      free.push({ start: cursor, end: taken.start });
    }
    cursor = taken.end;
  }
  if (cursor < base.end) {
    free.push({ start: cursor, end: base.end });
  }
  return free;
}

/**
 * True when `x` starts inside `range` (it may end after it). Used to give a block to one day only.
 */
export function startsWithin(x: Interval, range: Interval): boolean {
  return range.start <= x.start && x.start < range.end;
}

/**
 * The part of `x` inside `window`, or null when they do not overlap.
 */
export function clampInterval(x: Interval, window: Interval): Interval | null {
  const start = Math.max(x.start, window.start);
  const end = Math.min(x.end, window.end);
  return end > start ? { start, end } : null;
}

/**
 * Length of the interval in minutes.
 */
export function durationMinutes(x: Interval): number {
  return (x.end - x.start) / MS_PER_MINUTE;
}

/** Earlier start first; for equal starts the shorter interval first, so the order never depends on the input. */
function compareByStart(a: Interval, b: Interval): number {
  return a.start !== b.start ? a.start - b.start : a.end - b.end;
}
