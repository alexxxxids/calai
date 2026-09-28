import { describe, expect, it } from 'vitest';
import {
  createHabitSchema,
  updateHabitSchema,
  toggleHabitCheckSchema,
  isHabitScheduledForDay,
  calculateStreak,
} from './schemas';

describe('createHabitSchema', () => {
  it('accepts valid habit data and sorts weekdays', () => {
    const result = createHabitSchema.safeParse({
      name: '  Codzienne bieganie  ',
      weekdays: [5, 1, 3],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Codzienne bieganie');
      expect(result.data.weekdays).toEqual([1, 3, 5]);
    }
  });

  it('rejects empty or whitespace-only name', () => {
    const result = createHabitSchema.safeParse({
      name: '   ',
      weekdays: [1],
    });

    expect(result.success).toBe(false);
  });

  it('rejects name exceeding maximum length (61 chars)', () => {
    const longName = 'a'.repeat(61);
    const result = createHabitSchema.safeParse({
      name: longName,
      weekdays: [1],
    });

    expect(result.success).toBe(false);
  });

  it('accepts name of exactly 60 characters', () => {
    const validName = 'a'.repeat(60);
    const result = createHabitSchema.safeParse({
      name: validName,
      weekdays: [1],
    });

    expect(result.success).toBe(true);
  });

  it('rejects empty weekdays array', () => {
    const result = createHabitSchema.safeParse({
      name: 'Bieganie',
      weekdays: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects duplicate weekdays', () => {
    const result = createHabitSchema.safeParse({
      name: 'Bieganie',
      weekdays: [1, 2, 1],
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid weekday numbers', () => {
    expect(
      createHabitSchema.safeParse({ name: 'Nawyk', weekdays: [0] }).success,
    ).toBe(false);
    expect(
      createHabitSchema.safeParse({ name: 'Nawyk', weekdays: [8] }).success,
    ).toBe(false);
  });
});

describe('updateHabitSchema', () => {
  it('accepts valid update input', () => {
    const result = updateHabitSchema.safeParse({
      id: 'a0000000-0000-4000-8000-000000000001',
      name: 'Nowa nazwa',
      weekdays: [1, 2, 3],
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid uuid', () => {
    const result = updateHabitSchema.safeParse({
      id: 'invalid-uuid',
      name: 'Nowa nazwa',
      weekdays: [1],
    });

    expect(result.success).toBe(false);
  });
});

describe('toggleHabitCheckSchema', () => {
  it('accepts valid toggle input', () => {
    const result = toggleHabitCheckSchema.safeParse({
      habitId: 'a0000000-0000-4000-8000-000000000001',
      day: '2026-10-05',
      done: true,
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid date format or non-existent date', () => {
    expect(
      toggleHabitCheckSchema.safeParse({
        habitId: 'a0000000-0000-4000-8000-000000000001',
        day: '05-10-2026',
        done: true,
      }).success,
    ).toBe(false);

    expect(
      toggleHabitCheckSchema.safeParse({
        habitId: 'a0000000-0000-4000-8000-000000000001',
        day: '2026-02-31',
        done: true,
      }).success,
    ).toBe(false);
  });
});

describe('isHabitScheduledForDay', () => {
  it('correctly matches ISO weekdays for given date', () => {
    // 2026-10-05 is Monday (ISO 1)
    // 2026-10-06 is Tuesday (ISO 2)
    // 2026-10-11 is Sunday (ISO 7)
    const mwf = [1, 3, 5];

    expect(isHabitScheduledForDay(mwf, '2026-10-05')).toBe(true);
    expect(isHabitScheduledForDay(mwf, '2026-10-06')).toBe(false);
    expect(isHabitScheduledForDay(mwf, '2026-10-07')).toBe(true);
    expect(isHabitScheduledForDay([7], '2026-10-11')).toBe(true);
  });
});

describe('calculateStreak', () => {
  it('returns 0 for empty weekdays or no checks', () => {
    expect(calculateStreak([], '2026-10-05', [])).toBe(0);
    expect(calculateStreak([], '2026-10-05', [1, 2, 3])).toBe(0);
  });

  it('calculates daily streak correctly', () => {
    // 2026-10-01 to 2026-10-05 (5 days)
    const daily = [1, 2, 3, 4, 5, 6, 7];
    const checks = [
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
    ];

    expect(calculateStreak(checks, '2026-10-05', daily)).toBe(5);
  });

  it('does not count days not in schedule against streak', () => {
    // Habit on Mon(10-05), Wed(10-07), Fri(10-09)
    const mwf = [1, 3, 5];
    const checks = ['2026-10-05', '2026-10-07', '2026-10-09'];

    expect(calculateStreak(checks, '2026-10-09', mwf)).toBe(3);
  });

  it('allows streak to continue from yesterday if today is not checked yet', () => {
    // 2026-10-06 is Tuesday, not checked. Yesterday 2026-10-05 was checked.
    const daily = [1, 2, 3, 4, 5, 6, 7];
    const checks = ['2026-10-04', '2026-10-05'];

    expect(calculateStreak(checks, '2026-10-06', daily)).toBe(2);
  });

  it('breaks streak on missed scheduled day', () => {
    const daily = [1, 2, 3, 4, 5, 6, 7];
    // Missed 2026-10-04
    const checks = ['2026-10-02', '2026-10-03', '2026-10-05'];

    expect(calculateStreak(checks, '2026-10-05', daily)).toBe(1);
  });
});
