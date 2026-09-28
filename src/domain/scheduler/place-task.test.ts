import { describe, expect, it } from 'vitest';

import type { PlanContext, PlanDay, PlanState, TaskProgress } from '@/domain/scheduler/model';
import { placeRemainingWork } from '@/domain/scheduler/place-task';
import type { Interval, PlannerTask } from '@/domain/types';

const MONDAY = '2026-10-05';

/** An interval between two UTC times on Monday. */
function span(start: string, end: string): Interval {
  return { start: Date.parse(`${MONDAY}T${start}:00Z`), end: Date.parse(`${MONDAY}T${end}:00Z`) };
}

/** One task on a single Monday with working hours 08:00–22:00 UTC and the given busy intervals. */
function setup(
  fields: Partial<PlannerTask> & Pick<PlannerTask, 'workToPlan'>,
  busy: Interval[] = [],
) {
  const task: PlannerTask = {
    id: 'task',
    priority: 2,
    deadline: null,
    createdAt: 0,
    energy: 1,
    pace: 1,
    sessionMinutes: null,
    ...fields,
  };
  const owner: TaskProgress = {
    task,
    remaining: task.workToPlan,
    isQueued: false,
    hasEvicted: false,
  };
  const monday: PlanDay = {
    date: MONDAY,
    window: span('08:00', '22:00'),
    busy,
    busyLoad: 0,
    busyTaskIds: [],
  };
  const plan: PlanContext = { days: [monday], dayCapacity: 3600, heavyBusy: [] };
  const state: PlanState = { blocks: [], queue: [owner] };
  return { owner, plan, state };
}

function placed(state: PlanState): { interval: Interval; workMinutes: number }[] {
  return state.blocks.map((block) => ({
    interval: block.interval,
    workMinutes: block.workMinutes,
  }));
}

describe('placeRemainingWork', () => {
  it('should place the work in session-sized blocks at the earliest times', () => {
    const { owner, plan, state } = setup({ workToPlan: 180 });

    placeRemainingWork(owner, plan, state);

    expect(placed(state)).toEqual([
      { interval: span('08:00', '09:30'), workMinutes: 90 },
      { interval: span('09:30', '11:00'), workMinutes: 90 },
    ]);
    expect(owner.remaining).toBe(0);
  });

  it('should try a half when the full session fits nowhere and keep what still does not fit', () => {
    // Only 08:00–08:45 is free.
    const { owner, plan, state } = setup({ workToPlan: 90 }, [span('08:45', '22:00')]);

    placeRemainingWork(owner, plan, state);

    expect(placed(state)).toEqual([{ interval: span('08:00', '08:45'), workMinutes: 45 }]);
    expect(owner.remaining).toBe(45);
  });

  it('should leave all work remaining when nothing fits', () => {
    const { owner, plan, state } = setup({ workToPlan: 60 }, [span('08:00', '22:00')]);

    placeRemainingWork(owner, plan, state);

    expect(state.blocks).toEqual([]);
    expect(owner.remaining).toBe(60);
  });

  it('should make a block 30 minutes long when less work is left', () => {
    const { owner, plan, state } = setup({ workToPlan: 10 });

    placeRemainingWork(owner, plan, state);

    expect(placed(state)).toEqual([{ interval: span('08:00', '08:30'), workMinutes: 10 }]);
  });

  it('should stretch the block by the pace', () => {
    // A 90-minute session at pace 1.5 holds 60 minutes of work.
    const { owner, plan, state } = setup({ workToPlan: 60, pace: 1.5 });

    placeRemainingWork(owner, plan, state);

    expect(placed(state)).toEqual([{ interval: span('08:00', '09:30'), workMinutes: 60 }]);
  });

  it('should use the wanted session length when the task has one', () => {
    const { owner, plan, state } = setup({ workToPlan: 90, sessionMinutes: 45 });

    placeRemainingWork(owner, plan, state);

    expect(placed(state)).toEqual([
      { interval: span('08:00', '08:45'), workMinutes: 45 },
      { interval: span('08:45', '09:30'), workMinutes: 45 },
    ]);
  });

  it('should raise a wanted session shorter than 30 minutes to 30', () => {
    // The database allows session_minutes = 15, but a block is never shorter than MIN_SESSION.
    const { owner, plan, state } = setup({ workToPlan: 60, sessionMinutes: 15 });

    placeRemainingWork(owner, plan, state);

    expect(placed(state)).toEqual([
      { interval: span('08:00', '08:30'), workMinutes: 30 },
      { interval: span('08:30', '09:00'), workMinutes: 30 },
    ]);
  });

  it('should cap a demanding session at 120 minutes when a longer one is wanted', () => {
    const { owner, plan, state } = setup({ workToPlan: 180, energy: 3, sessionMinutes: 180 });

    placeRemainingWork(owner, plan, state);

    expect(placed(state)[0]).toEqual({ interval: span('08:00', '10:00'), workMinutes: 120 });
  });
});
