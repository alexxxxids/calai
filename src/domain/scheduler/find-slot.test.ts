import { describe, expect, it } from 'vitest';

import { findEarliestSlot } from '@/domain/scheduler/find-slot';
import type { DraftBlock, PlanContext, PlanDay, TaskProgress } from '@/domain/scheduler/model';
import type { Interval, PlannerTask } from '@/domain/types';

const MONDAY = '2026-10-05';
const TUESDAY = '2026-10-06';

/** An interval between two UTC times of a date. */
function span(date: string, start: string, end: string): Interval {
  return { start: Date.parse(`${date}T${start}:00Z`), end: Date.parse(`${date}T${end}:00Z`) };
}

/** A day with working hours 08:00–22:00 UTC and no fixed blocks of any task. */
function day(date: string, busy: Interval[] = [], busyLoad = 0): PlanDay {
  return { date, window: span(date, '08:00', '22:00'), busy, busyLoad, busyTaskIds: [] };
}

function context(days: PlanDay[], fields: Partial<PlanContext> = {}): PlanContext {
  return { days, dayCapacity: 3600, heavyBusy: [], ...fields };
}

function task(fields: Partial<PlannerTask> & Pick<PlannerTask, 'id'>): PlannerTask {
  return {
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

function card(owned: PlannerTask): TaskProgress {
  return { task: owned, remaining: 0, isQueued: false, hasEvicted: false };
}

describe('findEarliestSlot', () => {
  it('should return the earliest start on the grid inside free time', () => {
    const plan = context([day(MONDAY, [span(MONDAY, '08:00', '09:10')])]);

    const slot = findEarliestSlot({ task: task({ id: 'a' }), durationMinutes: 60 }, plan, []);

    expect(slot).toEqual({ dayIndex: 0, interval: span(MONDAY, '09:15', '10:15') });
  });

  it('should avoid blocks placed earlier in the same run', () => {
    const earlier: DraftBlock = {
      owner: card(task({ id: 'b' })),
      dayIndex: 0,
      interval: span(MONDAY, '08:00', '09:00'),
      workMinutes: 60,
    };

    const slot = findEarliestSlot(
      { task: task({ id: 'a' }), durationMinutes: 60 },
      context([day(MONDAY)]),
      [earlier],
    );

    expect(slot?.interval).toEqual(span(MONDAY, '09:00', '10:00'));
  });

  it('should return null when the only free time ends too late for the deadline', () => {
    // Free from 08:30; a 60-minute block would end at 09:30, after the 09:00 deadline.
    const plan = context([day(MONDAY, [span(MONDAY, '08:00', '08:30')]), day(TUESDAY)]);
    const due = task({ id: 'a', deadline: Date.parse(`${MONDAY}T09:00:00Z`) });

    expect(findEarliestSlot({ task: due, durationMinutes: 60 }, plan, [])).toBeNull();
  });

  it('should accept a block that ends exactly at the deadline', () => {
    const plan = context([day(MONDAY, [span(MONDAY, '08:00', '08:30')])]);
    const due = task({ id: 'a', deadline: Date.parse(`${MONDAY}T09:30:00Z`) });

    expect(findEarliestSlot({ task: due, durationMinutes: 60 }, plan, [])?.interval).toEqual(
      span(MONDAY, '08:30', '09:30'),
    );
  });

  it('should skip a day when the block would push it over the energy limit', () => {
    // Capacity 720 energy-minutes (12 points); Monday has used 690; 60 minutes of energy 1 need 60.
    const plan = context([day(MONDAY, [], 690), day(TUESDAY)], { dayCapacity: 720 });

    const slot = findEarliestSlot(
      { task: task({ id: 'a', energy: 1 }), durationMinutes: 60 },
      plan,
      [],
    );

    expect(slot?.dayIndex).toBe(1);
  });

  it('should skip a day when the task already has two blocks there', () => {
    const owner = card(task({ id: 'a' }));
    const blocks: DraftBlock[] = [
      { owner, dayIndex: 0, interval: span(MONDAY, '08:00', '09:00'), workMinutes: 60 },
      { owner, dayIndex: 0, interval: span(MONDAY, '09:00', '10:00'), workMinutes: 60 },
    ];

    const slot = findEarliestSlot(
      { task: owner.task, durationMinutes: 60 },
      context([day(MONDAY), day(TUESDAY)]),
      blocks,
    );

    expect(slot).toEqual({ dayIndex: 1, interval: span(TUESDAY, '08:00', '09:00') });
  });

  it('should count a fixed block of the task and a new one as the two blocks of the day', () => {
    // Monday: one pinned block of "a" (a fixed busy item) + one block placed in this run.
    const owner = card(task({ id: 'a' }));
    const monday = { ...day(MONDAY, [span(MONDAY, '12:00', '13:00')]), busyTaskIds: ['a'] };
    const placed: DraftBlock = {
      owner,
      dayIndex: 0,
      interval: span(MONDAY, '08:00', '09:00'),
      workMinutes: 60,
    };

    const slot = findEarliestSlot(
      { task: owner.task, durationMinutes: 60 },
      context([monday, day(TUESDAY)]),
      [placed],
    );

    expect(slot?.dayIndex).toBe(1);
  });

  it('should ignore fixed blocks of other tasks when counting sessions', () => {
    const monday = { ...day(MONDAY), busyTaskIds: ['b', 'b'] };

    const slot = findEarliestSlot(
      { task: task({ id: 'a' }), durationMinutes: 60 },
      context([monday]),
      [],
    );

    expect(slot?.dayIndex).toBe(0);
  });

  it('should leave a 20-minute break after demanding work when the task is demanding', () => {
    // A demanding lesson 08:00–09:30: starting at 09:30 or 09:45 would make 150 or 165 minutes in a row.
    const lesson = span(MONDAY, '08:00', '09:30');
    const plan = context([day(MONDAY, [lesson])], { heavyBusy: [lesson] });

    const slot = findEarliestSlot(
      { task: task({ id: 'a', energy: 3 }), durationMinutes: 60 },
      plan,
      [],
    );

    expect(slot?.interval).toEqual(span(MONDAY, '10:00', '11:00'));
  });

  it('should let light work follow demanding work without a break', () => {
    const lesson = span(MONDAY, '08:00', '09:30');
    const plan = context([day(MONDAY, [lesson])], { heavyBusy: [lesson] });

    const slot = findEarliestSlot(
      { task: task({ id: 'a', energy: 1 }), durationMinutes: 60 },
      plan,
      [],
    );

    expect(slot?.interval).toEqual(span(MONDAY, '09:30', '10:30'));
  });
});
