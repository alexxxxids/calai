import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatEnergy,
  formatMinutes,
  formatTime,
  formatWeekdays,
} from '@/lib/format';

describe('formatMinutes', () => {
  it('should show hours and minutes when there are both', () => {
    // Arrange
    const minutes = 90;

    // Act
    const text = formatMinutes(minutes);

    // Assert
    expect(text).toBe('1 h 30 min');
  });

  it('should show only hours when the minutes are a whole hour', () => {
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(600)).toBe('10 h');
  });

  it('should show only minutes when it is less than an hour', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(0)).toBe('0 min');
  });

  it('should round to a whole minute when the input has a fraction', () => {
    expect(formatMinutes(44.99999999999999)).toBe('45 min');
  });

  it('should throw when the minutes are negative', () => {
    expect(() => formatMinutes(-5)).toThrow(RangeError);
  });
});

describe('formatDate, formatTime, formatDateTime', () => {
  it('should show the moment in the given zone when zones disagree about the date', () => {
    // Arrange: 23:30 UTC on New Year's Eve is already 00:30 on 1 January in Warsaw.
    const instant = Date.UTC(2026, 11, 31, 23, 30);

    // Act
    const warsaw = formatDate(instant, 'Europe/Warsaw');
    const utc = formatDate(instant, 'UTC');

    // Assert
    expect(warsaw).toBe('1 stycznia 2027');
    expect(utc).toBe('31 grudnia 2026');
  });

  it('should show summer time when the moment is before the October clock change', () => {
    // 2026-10-25T00:30Z is 02:30 CEST (UTC+2), the first 02:30 of that night.
    expect(formatTime(Date.UTC(2026, 9, 25, 0, 30), 'Europe/Warsaw')).toBe('02:30');
  });

  it('should show winter time when the moment is after the October clock change', () => {
    // 2026-10-25T01:30Z is 02:30 CET (UTC+1), the second 02:30 of that night.
    expect(formatTime(Date.UTC(2026, 9, 25, 1, 30), 'Europe/Warsaw')).toBe('02:30');
  });

  it('should skip the missing hour when clocks go forward in March', () => {
    // 2026-03-29T01:00Z: clocks jumped from 02:00 straight to 03:00 in Warsaw.
    expect(formatTime(Date.UTC(2026, 2, 29, 1, 0), 'Europe/Warsaw')).toBe('03:00');
  });

  it('should show date and time together when asked for both', () => {
    expect(formatDateTime(Date.UTC(2026, 9, 5, 6, 0), 'Europe/Warsaw')).toBe(
      '5 października 2026 08:00',
    );
  });
});

describe('formatEnergy', () => {
  it('should give the Polish name when the level is known', () => {
    expect(formatEnergy(0)).toBe('regeneracja');
    expect(formatEnergy(3)).toBe('ciężkie');
  });

  it('should give the number itself when the level is unknown', () => {
    expect(formatEnergy(7)).toBe('7');
  });
});

describe('formatWeekdays', () => {
  it('should list short names in week order when the input is unordered', () => {
    expect(formatWeekdays([5, 1, 3])).toBe('pn, śr, pt');
  });

  it('should say "codziennie" when all seven days are chosen', () => {
    expect(formatWeekdays([7, 6, 5, 4, 3, 2, 1])).toBe('codziennie');
  });

  it('should not say "codziennie" when one day is missing', () => {
    expect(formatWeekdays([1, 2, 3, 4, 5, 6])).toBe('pn, wt, śr, cz, pt, sb');
  });
});
