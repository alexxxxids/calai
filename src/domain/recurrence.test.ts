import { describe, expect, it } from 'vitest';

import { expandWeekly, type WeeklyRule } from '@/domain/recurrence';
import type { Interval } from '@/domain/types';

const WARSAW = 'Europe/Warsaw';

/** Tuesday lesson 08:00–08:45 local time. */
const TUESDAY_LESSON: WeeklyRule = {
  weekday: 2,
  startTime: '08:00',
  endTime: '08:45',
  validFrom: '2026-09-01',
  validUntil: null,
};

function utc(start: string, end: string): Interval {
  return { start: Date.parse(start), end: Date.parse(end) };
}

describe('expandWeekly', () => {
  it('should keep the lesson at 08:00 local when clocks go back between October and November', () => {
    // Arrange: Monday 28 September to Wednesday 4 November; clocks go back on 25 October.
    const range = utc('2026-09-28T00:00:00Z', '2026-11-04T00:00:00Z');

    // Act
    const lessons = expandWeekly(TUESDAY_LESSON, range, WARSAW);

    // Assert: 06:00Z in summer time (UTC+2), 07:00Z in winter time (UTC+1).
    expect(lessons).toEqual([
      utc('2026-09-29T06:00:00Z', '2026-09-29T06:45:00Z'),
      utc('2026-10-06T06:00:00Z', '2026-10-06T06:45:00Z'),
      utc('2026-10-13T06:00:00Z', '2026-10-13T06:45:00Z'),
      utc('2026-10-20T06:00:00Z', '2026-10-20T06:45:00Z'),
      utc('2026-10-27T07:00:00Z', '2026-10-27T07:45:00Z'),
      utc('2026-11-03T07:00:00Z', '2026-11-03T07:45:00Z'),
    ]);
  });

  it('should include the last day when validUntil falls on the weekday', () => {
    const rule = { ...TUESDAY_LESSON, validUntil: '2026-10-13' };
    const range = utc('2026-10-05T00:00:00Z', '2026-10-31T00:00:00Z');

    const lessons = expandWeekly(rule, range, WARSAW);

    expect(lessons).toEqual([
      utc('2026-10-06T06:00:00Z', '2026-10-06T06:45:00Z'),
      utc('2026-10-13T06:00:00Z', '2026-10-13T06:45:00Z'),
    ]);
  });

  it('should include the first day when validFrom falls on the weekday', () => {
    const rule = { ...TUESDAY_LESSON, validFrom: '2026-10-13' };
    const range = utc('2026-10-05T00:00:00Z', '2026-10-18T00:00:00Z');

    const lessons = expandWeekly(rule, range, WARSAW);

    expect(lessons).toEqual([utc('2026-10-13T06:00:00Z', '2026-10-13T06:45:00Z')]);
  });

  it('should return an empty list when the range ends before the rule starts', () => {
    const range = utc('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z');

    expect(expandWeekly(TUESDAY_LESSON, range, WARSAW)).toEqual([]);
  });

  it('should return an empty list when the range starts after the rule ended', () => {
    const rule = { ...TUESDAY_LESSON, validUntil: '2026-09-30' };
    const range = utc('2026-10-05T00:00:00Z', '2026-10-31T00:00:00Z');

    expect(expandWeekly(rule, range, WARSAW)).toEqual([]);
  });

  it('should return an empty list when the range contains no such weekday', () => {
    // Wednesday 7 October to Sunday 11 October.
    const range = utc('2026-10-07T00:00:00Z', '2026-10-11T22:00:00Z');

    expect(expandWeekly(TUESDAY_LESSON, range, WARSAW)).toEqual([]);
  });

  it('should keep an occurrence when the range starts in the middle of it', () => {
    const range = utc('2026-10-06T06:30:00Z', '2026-10-13T06:00:00Z');

    const lessons = expandWeekly(TUESDAY_LESSON, range, WARSAW);

    // The 13 October lesson starts exactly at the end of the range, so it only touches it.
    expect(lessons).toEqual([utc('2026-10-06T06:00:00Z', '2026-10-06T06:45:00Z')]);
  });

  it('should skip an occurrence when it lies wholly inside the hour skipped in spring', () => {
    // Sundays 02:30–03:00; on 29 March 2026 the clocks jump from 02:00 straight to 03:00.
    const rule: WeeklyRule = {
      weekday: 7,
      startTime: '02:30',
      endTime: '03:00',
      validFrom: '2026-03-01',
      validUntil: null,
    };
    const range = utc('2026-03-21T00:00:00Z', '2026-04-06T00:00:00Z');

    const occurrences = expandWeekly(rule, range, WARSAW);

    expect(occurrences).toEqual([
      utc('2026-03-22T01:30:00Z', '2026-03-22T02:00:00Z'),
      utc('2026-04-05T00:30:00Z', '2026-04-05T01:00:00Z'),
    ]);
  });
});
