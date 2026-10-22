import { describe, expect, it } from 'vitest';
import {
  aggregateTypeStats,
  canAccessMonthlyReflection,
  canAccessWeeklyReflection,
  getCurrentMonthStart,
  getCurrentWeekStart,
  getMonthInterval,
  getNextMonthStart,
  getPreviousMonthStart,
  getPreviousWeekStart,
  isAllowedMonth,
  isAllowedWeek,
  type TypeStatsRow,
} from './rules';

describe('features/reflection/rules', () => {
  const warsaw = 'Europe/Warsaw';

  describe('week calculations and validations', () => {
    it('should determine the current and previous Monday correctly', () => {
      // 2026-10-15 is Thursday -> current week starts 2026-10-12 (Monday)
      const now = new Date('2026-10-15T14:30:00Z');
      expect(getCurrentWeekStart(now, warsaw)).toBe('2026-10-12');
      expect(getPreviousWeekStart(now, warsaw)).toBe('2026-10-05');
    });

    it('should handle Sunday correctly (Sunday belongs to week starting on preceding Monday)', () => {
      // 2026-10-18 20:00 Warsaw time is Sunday
      const sundayNow = new Date('2026-10-18T18:00:00Z');
      expect(getCurrentWeekStart(sundayNow, warsaw)).toBe('2026-10-12');
      expect(getPreviousWeekStart(sundayNow, warsaw)).toBe('2026-10-05');
    });

    it('should validate allowed weeks strictly (FR-100)', () => {
      const now = new Date('2026-10-15T14:30:00Z'); // Current: 2026-10-12, Previous: 2026-10-05

      // Allowed
      expect(isAllowedWeek('2026-10-12', now, warsaw)).toBe(true);
      expect(isAllowedWeek('2026-10-05', now, warsaw)).toBe(true);

      // Forbidden: two weeks ago
      expect(isAllowedWeek('2026-09-28', now, warsaw)).toBe(false);

      // Forbidden: future week
      expect(isAllowedWeek('2026-10-19', now, warsaw)).toBe(false);

      // Forbidden: not a Monday (2026-10-13 is Tuesday)
      expect(isAllowedWeek('2026-10-13', now, warsaw)).toBe(false);

      // Forbidden: invalid format or non-existent date
      expect(isAllowedWeek('invalid', now, warsaw)).toBe(false);
      expect(isAllowedWeek('2026-02-30', now, warsaw)).toBe(false);
    });
  });

  describe('month calculations and validations', () => {
    it('should calculate current, previous and next month starts', () => {
      const now = new Date('2026-10-15T14:30:00Z');
      expect(getCurrentMonthStart(now, warsaw)).toBe('2026-10-01');

      expect(getNextMonthStart('2026-10-01')).toBe('2026-11-01');
      expect(getNextMonthStart('2026-12-01')).toBe('2027-01-01');

      expect(getPreviousMonthStart('2026-10-01')).toBe('2026-09-01');
      expect(getPreviousMonthStart('2027-01-01')).toBe('2026-12-01');
    });

    it('should validate allowed months strictly (FR-101: current or previous month only)', () => {
      const now = new Date('2026-10-15T14:30:00Z');

      // Current month and previous month allowed
      expect(isAllowedMonth('2026-10-01', now, warsaw)).toBe(true);
      expect(isAllowedMonth('2026-09-01', now, warsaw)).toBe(true);

      // Future month forbidden
      expect(isAllowedMonth('2026-11-01', now, warsaw)).toBe(false);

      // Older month (2 months ago or older) forbidden (FR-101)
      expect(isAllowedMonth('2026-08-01', now, warsaw)).toBe(false);
      expect(isAllowedMonth('2025-01-01', now, warsaw)).toBe(false);

      // Invalid format or day not 01 forbidden
      expect(isAllowedMonth('2026-10-15', now, warsaw)).toBe(false);
      expect(isAllowedMonth('invalid', now, warsaw)).toBe(false);

      // Invalid month numbers 00 and 13-99 forbidden (H-3)
      expect(isAllowedMonth('2026-00-01', now, warsaw)).toBe(false);
      expect(isAllowedMonth('2026-13-01', now, warsaw)).toBe(false);
    });

    it('should throw when getNextMonthStart or getPreviousMonthStart receives invalid format', () => {
      expect(() => getNextMonthStart('2026-10-15')).toThrow(RangeError);
      expect(() => getPreviousMonthStart('invalid')).toThrow(RangeError);
    });

    it('should accurately calculate month interval across DST change (25.10.2026 in Europe/Warsaw)', () => {
      const interval = getMonthInterval('2026-10-01', warsaw);

      // October 1 in Warsaw (summer time, UTC+2) starts at 2026-09-30 22:00:00 UTC
      expect(interval.fromIso).toBe('2026-09-30T22:00:00.000Z');
      // November 1 in Warsaw (winter time after 25.10 transition, UTC+1) starts at 2026-10-31 23:00:00 UTC
      expect(interval.toIso).toBe('2026-10-31T23:00:00.000Z');
    });
  });

  describe('reflection level access control (FR-11)', () => {
    it('should enforce access rules for weekly reflections', () => {
      expect(canAccessWeeklyReflection('basic')).toBe(false);
      expect(canAccessWeeklyReflection('analytic')).toBe(true);
      expect(canAccessWeeklyReflection('strategic')).toBe(true);
    });

    it('should enforce access rules for monthly reflections', () => {
      expect(canAccessMonthlyReflection('basic')).toBe(false);
      expect(canAccessMonthlyReflection('analytic')).toBe(false);
      expect(canAccessMonthlyReflection('strategic')).toBe(true);
    });
  });

  describe('aggregateTypeStats (FR-21)', () => {
    it('should return empty list when input is empty', () => {
      expect(aggregateTypeStats([])).toEqual([]);
    });

    it('should preserve regular catalog types untouched', () => {
      const rows: TypeStatsRow[] = [
        {
          type_id: 't-1',
          type_name: 'Nauka',
          color: '#3b82f6',
          is_one_off: false,
          planned_minutes: 120,
          actual_minutes: 110,
          done_blocks: 2,
          missed_blocks: 0,
        },
        {
          type_id: 't-2',
          type_name: 'Sport',
          color: '#22c55e',
          is_one_off: false,
          planned_minutes: 60,
          actual_minutes: 60,
          done_blocks: 1,
          missed_blocks: 0,
        },
      ];

      const result = aggregateTypeStats(rows);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        typeId: 't-1',
        typeName: 'Nauka',
        color: '#3b82f6',
        isOneOff: false,
        plannedMinutes: 120,
        actualMinutes: 110,
        doneBlocks: 2,
        missedBlocks: 0,
      });
      expect(result[1]).toEqual({
        typeId: 't-2',
        typeName: 'Sport',
        color: '#22c55e',
        isOneOff: false,
        plannedMinutes: 60,
        actualMinutes: 60,
        doneBlocks: 1,
        missedBlocks: 0,
      });
    });

    it('should aggregate all one-off types into a single "Jednorazowe" item (FR-21)', () => {
      const rows: TypeStatsRow[] = [
        {
          type_id: 't-1',
          type_name: 'Nauka',
          color: '#3b82f6',
          is_one_off: false,
          planned_minutes: 100,
          actual_minutes: 90,
          done_blocks: 1,
          missed_blocks: 0,
        },
        {
          type_id: 'one-1',
          type_name: 'Dentysta',
          color: '#ef4444',
          is_one_off: true,
          planned_minutes: 60,
          actual_minutes: 70,
          done_blocks: 1,
          missed_blocks: 0,
        },
        {
          type_id: 'one-2',
          type_name: 'Urząd skarbowy',
          color: '#eab308',
          is_one_off: true,
          planned_minutes: 90,
          actual_minutes: 0,
          done_blocks: 0,
          missed_blocks: 1,
        },
      ];

      const result = aggregateTypeStats(rows);
      expect(result).toHaveLength(2);
      const [first, second] = result;
      expect(first?.typeName).toBe('Nauka');
      expect(first?.isOneOff).toBe(false);

      expect(second).toEqual({
        typeId: 'one-off-aggregate',
        typeName: 'Jednorazowe',
        color: '#888888',
        isOneOff: true,
        plannedMinutes: 150, // 60 + 90
        actualMinutes: 70,  // 70 + 0
        doneBlocks: 1,     // 1 + 0
        missedBlocks: 1,   // 0 + 1
      });
    });
  });
});
