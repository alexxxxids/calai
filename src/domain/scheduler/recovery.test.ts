import { describe, expect, it } from 'vitest';

import type { PlanDay } from '@/domain/scheduler/model';
import { recoveryBlocks } from '@/domain/scheduler/recovery';
import type { Interval } from '@/domain/types';

function span(date: string, start: string, end: string): Interval {
  return { start: Date.parse(`${date}T${start}:00Z`), end: Date.parse(`${date}T${end}:00Z`) };
}

function day(date: string, window: Interval, busy: Interval[]): PlanDay {
  return { date, window, busy, busyLoad: 0, busyTaskIds: [] };
}

describe('recoveryBlocks', () => {
  it('should end the block where the last free window ends when the evening is free', () => {
    const days = [
      day('2026-10-05', span('2026-10-05', '08:00', '22:00'), [
        span('2026-10-05', '08:00', '14:00'),
      ]),
    ];

    expect(recoveryBlocks(days)).toEqual([
      { owner: null, dayIndex: 0, interval: span('2026-10-05', '21:00', '22:00'), workMinutes: 60 },
    ]);
  });

  it('should choose the latest free window when several windows have a free hour', () => {
    // Free: 08:00–12:00 and 13:00–22:00; rest belongs in the evening, not before lunch.
    const days = [
      day('2026-10-05', span('2026-10-05', '08:00', '22:00'), [
        span('2026-10-05', '12:00', '13:00'),
      ]),
    ];

    expect(recoveryBlocks(days).map((block) => block.interval)).toEqual([
      span('2026-10-05', '21:00', '22:00'),
    ]);
  });

  it('should use an earlier free window when the last one is shorter than an hour', () => {
    // Free: 08:00–20:00 and 21:30–22:00; the half hour at the end is too short.
    const days = [
      day('2026-10-05', span('2026-10-05', '08:00', '22:00'), [
        span('2026-10-05', '20:00', '21:30'),
      ]),
    ];

    expect(recoveryBlocks(days).map((block) => block.interval)).toEqual([
      span('2026-10-05', '19:00', '20:00'),
    ]);
  });

  it('should round the end down to the grid when a busy item starts off the grid', () => {
    const days = [
      day('2026-10-05', span('2026-10-05', '08:00', '22:00'), [
        span('2026-10-05', '19:50', '22:00'),
      ]),
    ];

    expect(recoveryBlocks(days).map((block) => block.interval)).toEqual([
      span('2026-10-05', '18:45', '19:45'),
    ]);
  });

  it('should skip a day without a free hour and keep the day index of the others', () => {
    const days = [
      day('2026-10-05', span('2026-10-05', '08:00', '22:00'), [
        span('2026-10-05', '08:00', '21:15'),
      ]),
      day('2026-10-06', span('2026-10-06', '08:00', '22:00'), []),
    ];

    expect(recoveryBlocks(days)).toEqual([
      { owner: null, dayIndex: 1, interval: span('2026-10-06', '21:00', '22:00'), workMinutes: 60 },
    ]);
  });
});
