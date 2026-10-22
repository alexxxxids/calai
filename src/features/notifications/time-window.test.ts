import { describe, expect, it } from 'vitest';
import { zonedToInstant } from '@/domain/time';
import {
  isEndOfDayWindow,
  isSundayReflectionWindow,
  isWithinUpcomingWindow,
} from './time-window';

describe('time-window calculations', () => {
  const WARSAW_TZ = 'Europe/Warsaw';

  describe('isWithinUpcomingWindow', () => {
    const baseNow = 1_000_000_000_000;
    const minute = 60 * 1000;

    it('returns false when block starts earlier than 5 minutes', () => {
      const blockStart = baseNow + 4 * minute + 59 * 1000;
      expect(isWithinUpcomingWindow(baseNow, blockStart)).toBe(false);
    });

    it('returns true exactly at 5 minutes', () => {
      const blockStart = baseNow + 5 * minute;
      expect(isWithinUpcomingWindow(baseNow, blockStart)).toBe(true);
    });

    it('returns true in the middle of the window (10 minutes)', () => {
      const blockStart = baseNow + 10 * minute;
      expect(isWithinUpcomingWindow(baseNow, blockStart)).toBe(true);
    });

    it('returns true at 14m59s', () => {
      const blockStart = baseNow + 14 * minute + 59 * 1000;
      expect(isWithinUpcomingWindow(baseNow, blockStart)).toBe(true);
    });

    it('returns false at 15 minutes and beyond', () => {
      const blockStart = baseNow + 15 * minute;
      expect(isWithinUpcomingWindow(baseNow, blockStart)).toBe(false);
      expect(isWithinUpcomingWindow(baseNow, blockStart + minute)).toBe(false);
    });
  });

  describe('isEndOfDayWindow', () => {
    // 2026-10-12 is a Monday.
    it('returns true when current time is in [22:00, 22:05) in Warsaw', () => {
      const instantAt2200 = zonedToInstant('2026-10-12', '22:00', WARSAW_TZ);
      const instantAt2204 = zonedToInstant('2026-10-12', '22:04', WARSAW_TZ);
      const instantAt2205 = zonedToInstant('2026-10-12', '22:05', WARSAW_TZ);
      const instantAt2159 = zonedToInstant('2026-10-12', '21:59', WARSAW_TZ);

      expect(isEndOfDayWindow(instantAt2200, WARSAW_TZ, '22:00')).toBe(true);
      expect(isEndOfDayWindow(instantAt2204, WARSAW_TZ, '22:00')).toBe(true);
      expect(isEndOfDayWindow(instantAt2205, WARSAW_TZ, '22:00')).toBe(false);
      expect(isEndOfDayWindow(instantAt2159, WARSAW_TZ, '22:00')).toBe(false);
    });

    it('correctly handles day_end near midnight wrapping into the next day (H-4)', () => {
      // 23:58 window wraps into next day: [23:58, 00:03)
      const instantAt2357 = zonedToInstant('2026-10-12', '23:57', WARSAW_TZ);
      const instantAt2358 = zonedToInstant('2026-10-12', '23:58', WARSAW_TZ);
      const instantAt0000 = zonedToInstant('2026-10-13', '00:00', WARSAW_TZ);
      const instantAt0002 = zonedToInstant('2026-10-13', '00:02', WARSAW_TZ);
      const instantAt0003 = zonedToInstant('2026-10-13', '00:03', WARSAW_TZ);

      expect(isEndOfDayWindow(instantAt2357, WARSAW_TZ, '23:58')).toBe(false);
      expect(isEndOfDayWindow(instantAt2358, WARSAW_TZ, '23:58')).toBe(true);
      expect(isEndOfDayWindow(instantAt0000, WARSAW_TZ, '23:58')).toBe(true);
      expect(isEndOfDayWindow(instantAt0002, WARSAW_TZ, '23:58')).toBe(true);
      expect(isEndOfDayWindow(instantAt0003, WARSAW_TZ, '23:58')).toBe(false);
    });
  });

  describe('isSundayReflectionWindow', () => {
    // 2026-10-18 is Sunday (isoWeekday = 7)
    // 2026-10-17 is Saturday (isoWeekday = 6)
    // 2026-10-19 is Monday (isoWeekday = 1)
    it('returns true on Sunday between 19:00 and 19:04:59 in Warsaw', () => {
      const sunday1900 = zonedToInstant('2026-10-18', '19:00', WARSAW_TZ);
      const sunday1904 = zonedToInstant('2026-10-18', '19:04', WARSAW_TZ);
      const sunday1905 = zonedToInstant('2026-10-18', '19:05', WARSAW_TZ);
      const sunday1859 = zonedToInstant('2026-10-18', '18:59', WARSAW_TZ);

      expect(isSundayReflectionWindow(sunday1900, WARSAW_TZ)).toBe(true);
      expect(isSundayReflectionWindow(sunday1904, WARSAW_TZ)).toBe(true);
      expect(isSundayReflectionWindow(sunday1905, WARSAW_TZ)).toBe(false);
      expect(isSundayReflectionWindow(sunday1859, WARSAW_TZ)).toBe(false);
    });

    it('returns false on other days even at 19:00', () => {
      const saturday1900 = zonedToInstant('2026-10-17', '19:00', WARSAW_TZ);
      const monday1900 = zonedToInstant('2026-10-19', '19:00', WARSAW_TZ);

      expect(isSundayReflectionWindow(saturday1900, WARSAW_TZ)).toBe(false);
      expect(isSundayReflectionWindow(monday1900, WARSAW_TZ)).toBe(false);
    });
  });
});
