import { describe, expect, it } from 'vitest';

import { normalizeSessionMinutes, sessionLength } from '@/domain/scheduler/session';
import type { PlannerTask } from '@/domain/types';

function task(fields: Partial<PlannerTask>): PlannerTask {
  return {
    id: 'a',
    priority: 2,
    deadline: null,
    createdAt: 0,
    energy: 1,
    workToPlan: 60,
    pace: 1,
    sessionMinutes: null,
    ...fields,
  };
}

describe('normalizeSessionMinutes', () => {
  it.each([
    { minutes: 30, expected: 30 },
    { minutes: 90, expected: 90 },
    { minutes: 180, expected: 180 },
  ])('should keep $minutes when it is valid already', ({ minutes, expected }) => {
    expect(normalizeSessionMinutes(minutes)).toBe(expected);
  });

  it.each([
    { minutes: 50, expected: 45 },
    { minutes: 59, expected: 45 },
    { minutes: 179, expected: 165 },
  ])(
    'should round $minutes down to the grid when it is not a multiple of 15',
    ({ minutes, expected }) => {
      expect(normalizeSessionMinutes(minutes)).toBe(expected);
    },
  );

  it.each([
    { minutes: 15, expected: 30 },
    { minutes: 20, expected: 30 },
    { minutes: 44, expected: 30 },
  ])('should raise $minutes to 30 when the rounded session is shorter', ({ minutes, expected }) => {
    expect(normalizeSessionMinutes(minutes)).toBe(expected);
  });

  it.each([
    { minutes: 185, expected: 180 },
    { minutes: 240, expected: 180 },
  ])('should cut $minutes to 180 when it is longer', ({ minutes, expected }) => {
    expect(normalizeSessionMinutes(minutes)).toBe(expected);
  });
});

describe('sessionLength', () => {
  it('should use 90 minutes when the task has no session length', () => {
    expect(sessionLength(task({ sessionMinutes: null }))).toBe(90);
  });

  it('should use the normalized session of the task', () => {
    expect(sessionLength(task({ sessionMinutes: 50 }))).toBe(45);
  });

  it('should cap demanding work at 120 minutes', () => {
    expect(sessionLength(task({ sessionMinutes: 180, energy: 3 }))).toBe(120);
  });

  it('should allow light work up to 180 minutes', () => {
    expect(sessionLength(task({ sessionMinutes: 180, energy: 1 }))).toBe(180);
  });
});
