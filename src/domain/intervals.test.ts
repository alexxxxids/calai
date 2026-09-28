import { describe, expect, it } from 'vitest';

import {
  clampInterval,
  durationMinutes,
  mergeIntervals,
  overlaps,
  startsWithin,
  subtractIntervals,
} from '@/domain/intervals';
import type { Interval } from '@/domain/types';

/** An interval on 2026-10-05 between two UTC wall-clock times, e.g. span('08:00', '22:00'). */
function span(start: string, end: string): Interval {
  return {
    start: Date.parse(`2026-10-05T${start}:00Z`),
    end: Date.parse(`2026-10-05T${end}:00Z`),
  };
}

describe('overlaps', () => {
  it('should be true when the intervals share some time', () => {
    expect(overlaps(span('10:00', '11:00'), span('10:30', '12:00'))).toBe(true);
  });

  it('should be true when one interval contains the other', () => {
    expect(overlaps(span('08:00', '22:00'), span('10:00', '11:00'))).toBe(true);
  });

  it('should be false when the intervals only touch', () => {
    expect(overlaps(span('10:00', '11:00'), span('11:00', '12:00'))).toBe(false);
  });

  it('should be false when the intervals are apart', () => {
    expect(overlaps(span('10:00', '11:00'), span('12:00', '13:00'))).toBe(false);
  });
});

describe('mergeIntervals', () => {
  it('should return an empty list when the input is empty', () => {
    expect(mergeIntervals([])).toEqual([]);
  });

  it('should merge intervals when they overlap', () => {
    expect(mergeIntervals([span('10:00', '11:00'), span('10:30', '12:00')])).toEqual([
      span('10:00', '12:00'),
    ]);
  });

  it('should merge intervals when they only touch', () => {
    expect(mergeIntervals([span('10:00', '11:00'), span('11:00', '12:00')])).toEqual([
      span('10:00', '12:00'),
    ]);
  });

  it('should sort the result when the input is not sorted', () => {
    expect(mergeIntervals([span('14:00', '15:00'), span('08:00', '09:00')])).toEqual([
      span('08:00', '09:00'),
      span('14:00', '15:00'),
    ]);
  });

  it('should swallow an interval when another one contains it', () => {
    expect(mergeIntervals([span('08:00', '12:00'), span('09:00', '10:00')])).toEqual([
      span('08:00', '12:00'),
    ]);
  });

  it('should not change the input list', () => {
    const input = [span('14:00', '15:00'), span('08:00', '09:00')];

    mergeIntervals(input);

    expect(input).toEqual([span('14:00', '15:00'), span('08:00', '09:00')]);
  });
});

describe('subtractIntervals', () => {
  it('should cut out overlapping busy intervals when they lie inside the base', () => {
    // The reference case from docs/algorithms.md §2.
    const free = subtractIntervals(span('08:00', '22:00'), [
      span('10:00', '11:00'),
      span('10:30', '12:00'),
    ]);

    expect(free).toEqual([span('08:00', '10:00'), span('12:00', '22:00')]);
  });

  it('should return the base unchanged when nothing is busy', () => {
    expect(subtractIntervals(span('08:00', '22:00'), [])).toEqual([span('08:00', '22:00')]);
  });

  it('should return an empty list when a busy interval covers the whole base', () => {
    expect(subtractIntervals(span('08:00', '22:00'), [span('07:00', '23:00')])).toEqual([]);
  });

  it('should cut the edges when busy intervals stick out of the base', () => {
    const free = subtractIntervals(span('08:00', '22:00'), [
      span('07:00', '09:00'),
      span('21:00', '23:00'),
    ]);

    expect(free).toEqual([span('09:00', '21:00')]);
  });

  it('should ignore busy intervals when they lie outside the base', () => {
    const free = subtractIntervals(span('08:00', '12:00'), [
      span('06:00', '07:00'),
      span('13:00', '14:00'),
    ]);

    expect(free).toEqual([span('08:00', '12:00')]);
  });

  it('should leave no empty gap when busy intervals touch each other', () => {
    const free = subtractIntervals(span('08:00', '12:00'), [
      span('09:00', '10:00'),
      span('10:00', '11:00'),
    ]);

    expect(free).toEqual([span('08:00', '09:00'), span('11:00', '12:00')]);
  });

  it('should return sorted parts when busy intervals come unsorted', () => {
    const free = subtractIntervals(span('08:00', '12:00'), [
      span('10:00', '11:00'),
      span('08:30', '09:00'),
    ]);

    expect(free).toEqual([span('08:00', '08:30'), span('09:00', '10:00'), span('11:00', '12:00')]);
  });
});

describe('startsWithin', () => {
  it('should be true when the interval starts inside the range, even if it ends after it', () => {
    expect(startsWithin(span('21:30', '23:00'), span('08:00', '22:00'))).toBe(true);
  });

  it('should be true when the interval starts exactly at the start of the range', () => {
    expect(startsWithin(span('08:00', '09:00'), span('08:00', '22:00'))).toBe(true);
  });

  it('should be false when the interval starts exactly at the end of the range', () => {
    expect(startsWithin(span('22:00', '23:00'), span('08:00', '22:00'))).toBe(false);
  });

  it('should be false when the interval started before the range', () => {
    expect(startsWithin(span('07:00', '09:00'), span('08:00', '22:00'))).toBe(false);
  });
});

describe('clampInterval', () => {
  it('should return the common part when the interval sticks out of the window', () => {
    expect(clampInterval(span('07:00', '09:00'), span('08:00', '22:00'))).toEqual(
      span('08:00', '09:00'),
    );
  });

  it('should return the interval itself when it lies inside the window', () => {
    expect(clampInterval(span('10:00', '11:00'), span('08:00', '22:00'))).toEqual(
      span('10:00', '11:00'),
    );
  });

  it('should return null when the interval only touches the window', () => {
    expect(clampInterval(span('07:00', '08:00'), span('08:00', '22:00'))).toBeNull();
  });

  it('should return null when the interval lies outside the window', () => {
    expect(clampInterval(span('05:00', '06:00'), span('08:00', '22:00'))).toBeNull();
  });
});

describe('durationMinutes', () => {
  it('should return the length in minutes', () => {
    expect(durationMinutes(span('08:00', '09:30'))).toBe(90);
  });
});
