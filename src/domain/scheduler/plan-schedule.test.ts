import { describe, expect, it } from 'vitest';

import { planSchedule } from '@/domain/scheduler';
import type { BusyItem, Interval, PlannerInput, PlannerResult, PlannerTask } from '@/domain/types';

// Scenarios of docs/algorithms.md §5.3, §6.3 and §6.5. The invariants of §6.6 live in
// plan-schedule.invariants.test.ts. Expected blocks were placed by hand, as the comments show.
// Dates are in October 2026 before the clock change on the 25th (Warsaw = UTC+2) unless a test says otherwise.

const MONDAY = '2026-10-05';
const TUESDAY = '2026-10-06';
const WEDNESDAY = '2026-10-07';

/** Warsaw wall-clock time as an instant (1–24 October 2026 only, UTC+2). */
function at(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00+02:00`);
}

function span(date: string, start: string, end: string): Interval {
  return { start: at(date, start), end: at(date, end) };
}

function task(fields: Partial<PlannerTask> & Pick<PlannerTask, 'id' | 'workToPlan'>): PlannerTask {
  return {
    priority: 2,
    deadline: null,
    createdAt: 0,
    energy: 1,
    pace: 1,
    sessionMinutes: null,
    ...fields,
  };
}

function busy(start: number, end: number, energy: number): BusyItem {
  return { interval: { start, end }, energy };
}

/** Monday 07:45: with the 15-minute buffer the horizon starts at 08:00, when working hours begin. */
function plannerInput(fields: Partial<PlannerInput>): PlannerInput {
  return {
    now: at(MONDAY, '07:45'),
    timezone: 'Europe/Warsaw',
    dayStart: '08:00',
    dayEnd: '22:00',
    energyLimit: 60,
    stressMode: false,
    busy: [],
    tasks: [],
    ...fields,
  };
}

/** Busy (at no energy cost) from Tuesday to past the end of the horizon: only Monday is free. */
const ONLY_MONDAY_FREE = busy(at(TUESDAY, '00:00'), at('2026-10-20', '00:00'), 0);

function intervalsOf(result: PlannerResult): Interval[] {
  return result.blocks.map((block) => block.interval);
}

describe('planSchedule: horizon (§6.3 step 1)', () => {
  it('should start at now + 15 minutes rounded up to the grid when now is off the grid', () => {
    // Arrange: 07:52 + 15 min = 08:07 → 08:15.
    const input = plannerInput({
      now: at(MONDAY, '07:52'),
      tasks: [task({ id: 'a', workToPlan: 60 })],
    });

    // Act
    const result = planSchedule(input);

    // Assert
    expect(intervalsOf(result)).toEqual([span(MONDAY, '08:15', '09:15')]);
  });

  it('should keep the next 15 minutes free when now is exactly on the grid', () => {
    const input = plannerInput({
      now: at(MONDAY, '10:00'),
      tasks: [task({ id: 'a', workToPlan: 60 })],
    });

    const result = planSchedule(input);

    expect(intervalsOf(result)).toEqual([span(MONDAY, '10:15', '11:15')]);
  });

  it('should plan no further than 14 days ahead when no task has a deadline', () => {
    // Arrange: far more work than fits; energy 0, so only the horizon and the 2 sessions a day limit it.
    const input = plannerInput({ tasks: [task({ id: 'hobby', workToPlan: 6000, energy: 0 })] });

    // Act
    const result = planSchedule(input);

    // Assert: 5–18 October = 14 days × 2 sessions × 90 min = 2520 min; 6000 − 2520 = 3480 do not fit.
    expect(result.blocks).toHaveLength(28);
    expect(result.blocks.at(-1)?.interval).toEqual(span('2026-10-18', '09:30', '11:00'));
    expect(result.unscheduled).toEqual([
      { taskId: 'hobby', missingMinutes: 3480, reason: 'capacity' },
    ]);
  });

  it('should reach the farthest deadline when it is more than 14 days away', () => {
    // Arrange: everything is busy until 20 October; the deadline is on 24 October.
    const input = plannerInput({
      busy: [busy(at(MONDAY, '00:00'), at('2026-10-20', '00:00'), 0)],
      tasks: [task({ id: 'project', workToPlan: 60, deadline: at('2026-10-24', '20:00') })],
    });

    // Act
    const result = planSchedule(input);

    // Assert
    expect(intervalsOf(result)).toEqual([span('2026-10-20', '08:00', '09:00')]);
  });

  it('should never plan more than 60 days ahead even when the deadline is later', () => {
    // Arrange: 60 days after 5 October 08:00 CEST is 4 December 07:00 CET, before working hours.
    // Everything is busy until 4 December 00:00 CET (3 December 23:00Z); after that the calendar is free.
    const input = plannerInput({
      busy: [busy(at(MONDAY, '00:00'), Date.parse('2026-12-03T23:00:00Z'), 0)],
      tasks: [task({ id: 'thesis', workToPlan: 60, deadline: Date.parse('2027-01-10T12:00:00Z') })],
    });

    // Act
    const result = planSchedule(input);

    // Assert: the free December days lie beyond the horizon, and the deadline is not what was missed.
    expect(result.blocks).toEqual([]);
    expect(result.unscheduled).toEqual([
      { taskId: 'thesis', missingMinutes: 60, reason: 'capacity' },
    ]);
  });

  it('should use local working hours on the day the clocks go back', () => {
    // Arrange: Saturday 24 October 21:50 CEST (19:50Z). The horizon starts at 22:15, after working
    // hours, so the first working day is Sunday 25 October, when 08:00 CET is 07:00Z.
    const input = plannerInput({
      now: Date.parse('2026-10-24T19:50:00Z'),
      tasks: [task({ id: 'a', workToPlan: 60 })],
    });

    // Act
    const result = planSchedule(input);

    // Assert
    expect(intervalsOf(result)).toEqual([
      { start: Date.parse('2026-10-25T07:00:00Z'), end: Date.parse('2026-10-25T08:00:00Z') },
    ]);
  });
});

describe('planSchedule: block size (§6.3 step 6)', () => {
  it('should split a session into halves when the full session fits nowhere', () => {
    // Arrange: only two 45-minute gaps, 08:00–08:45 and 10:00–10:45.
    const input = plannerInput({
      busy: [
        busy(at(MONDAY, '08:45'), at(MONDAY, '10:00'), 0),
        busy(at(MONDAY, '10:45'), at(MONDAY, '22:00'), 0),
        ONLY_MONDAY_FREE,
      ],
      tasks: [task({ id: 'essay', workToPlan: 90 })],
    });

    // Act
    const result = planSchedule(input);

    // Assert
    expect(result.blocks).toEqual([
      {
        taskId: 'essay',
        interval: span(MONDAY, '08:00', '08:45'),
        workMinutes: 45,
        source: 'planner',
      },
      {
        taskId: 'essay',
        interval: span(MONDAY, '10:00', '10:45'),
        workMinutes: 45,
        source: 'planner',
      },
    ]);
    expect(result.unscheduled).toEqual([]);
  });

  it('should round an old session length that is off the grid down to it', () => {
    // Arrange: session_minutes = 50 from data saved before the 15-minute rule.
    const input = plannerInput({ tasks: [task({ id: 'a', workToPlan: 90, sessionMinutes: 50 })] });

    // Act
    const result = planSchedule(input);

    // Assert: 45-minute sessions, never longer than the 50 minutes the user asked for.
    expect(result.blocks).toEqual([
      { taskId: 'a', interval: span(MONDAY, '08:00', '08:45'), workMinutes: 45, source: 'planner' },
      { taskId: 'a', interval: span(MONDAY, '08:45', '09:30'), workMinutes: 45, source: 'planner' },
    ]);
  });

  it('should make the block 30 minutes long when less work is left', () => {
    const input = plannerInput({ tasks: [task({ id: 'a', workToPlan: 10 })] });

    const result = planSchedule(input);

    expect(result.blocks).toEqual([
      { taskId: 'a', interval: span(MONDAY, '08:00', '08:30'), workMinutes: 10, source: 'planner' },
    ]);
  });

  it('should split the calibrated essay into a 90-minute and a 30-minute block when its session is 90 minutes', () => {
    // Arrange: docs/algorithms.md §4.4 — 90 minutes of work left at pace 7/6. A 90-minute session
    // holds floor(90 / (7/6)) = 77 minutes of work; the other 13 minutes get a 30-minute block.
    const pace = 0.5 * (120 / 90) + 0.5 * 1.0;
    const input = plannerInput({
      busy: [ONLY_MONDAY_FREE],
      tasks: [task({ id: 'essay', workToPlan: 90, pace, sessionMinutes: 90, energy: 3 })],
    });

    // Act
    const result = planSchedule(input);

    // Assert: 90 + 30 = 120 minutes of demanding work in a row is exactly the allowed maximum.
    expect(result.blocks).toEqual([
      {
        taskId: 'essay',
        interval: span(MONDAY, '08:00', '09:30'),
        workMinutes: 77,
        source: 'planner',
      },
      {
        taskId: 'essay',
        interval: span(MONDAY, '09:30', '10:00'),
        workMinutes: 13,
        source: 'planner',
      },
    ]);
  });

  it('should cap a demanding session at 120 minutes when a longer one is wanted', () => {
    // Arrange: energy 3, sessions of 180 minutes wanted.
    const input = plannerInput({
      tasks: [task({ id: 'project', workToPlan: 240, energy: 3, sessionMinutes: 180 })],
    });

    // Act
    const result = planSchedule(input);

    // Assert: two 120-minute blocks; 10:00 and 10:15 would not leave a 20-minute break.
    expect(result.blocks).toEqual([
      {
        taskId: 'project',
        interval: span(MONDAY, '08:00', '10:00'),
        workMinutes: 120,
        source: 'planner',
      },
      {
        taskId: 'project',
        interval: span(MONDAY, '10:30', '12:30'),
        workMinutes: 120,
        source: 'planner',
      },
    ]);
  });

  it('should count busy items outside working hours into the load of the day', () => {
    // Arrange: a 06:00–07:00 training of energy 3 = 3 points; limit 4; the task needs 1.5 points.
    const input = plannerInput({
      energyLimit: 4,
      busy: [busy(at(MONDAY, '06:00'), at(MONDAY, '07:00'), 3)],
      tasks: [task({ id: 'a', workToPlan: 90, energy: 1 })],
    });

    // Act
    const result = planSchedule(input);

    // Assert: 3 + 1.5 > 4 on Monday.
    expect(intervalsOf(result)).toEqual([span(TUESDAY, '08:00', '09:30')]);
  });

  it('should count a lesson that ended before the horizon into a demanding chain', () => {
    // Arrange: now 09:45, so the horizon starts at 10:00; a 110-minute lesson (energy 2) ended at 09:50.
    const input = plannerInput({
      now: at(MONDAY, '09:45'),
      busy: [busy(at(MONDAY, '08:00'), at(MONDAY, '09:50'), 2)],
      tasks: [task({ id: 'math', workToPlan: 60, energy: 3 })],
    });

    // Act
    const result = planSchedule(input);

    // Assert: at 10:00 the break would be 10 minutes (chain 08:00–11:00); 10:15 leaves 25 minutes.
    expect(intervalsOf(result)).toEqual([span(MONDAY, '10:15', '11:15')]);
  });
});

describe('planSchedule: recovery in stress mode (§5.3)', () => {
  it('should put the recovery block into the latest free hour of each day', () => {
    // Arrange: Monday is busy from 19:50, Tuesday from 13:00; Wednesday is free.
    const input = plannerInput({
      stressMode: true,
      busy: [
        busy(at(MONDAY, '19:50'), at(MONDAY, '22:00'), 0),
        busy(at(TUESDAY, '13:00'), at(TUESDAY, '22:00'), 0),
      ],
    });

    // Act
    const result = planSchedule(input);

    // Assert: 19:50 rounds down to 19:45 on the grid.
    expect(intervalsOf(result).slice(0, 3)).toEqual([
      span(MONDAY, '18:45', '19:45'),
      span(TUESDAY, '12:00', '13:00'),
      span(WEDNESDAY, '21:00', '22:00'),
    ]);
    expect(result.blocks[0]).toEqual({
      taskId: null,
      interval: span(MONDAY, '18:45', '19:45'),
      workMinutes: 60,
      source: 'rest',
    });
  });

  it('should plan task work around the recovery block', () => {
    // Arrange: Monday is free only 20:00–22:00; the recovery block takes 21:00–22:00 first.
    const input = plannerInput({
      stressMode: true,
      busy: [busy(at(MONDAY, '08:00'), at(MONDAY, '20:00'), 0), ONLY_MONDAY_FREE],
      tasks: [
        task({ id: 'a', workToPlan: 60, createdAt: 1 }),
        task({ id: 'b', workToPlan: 60, createdAt: 2 }),
      ],
    });

    // Act
    const result = planSchedule(input);

    // Assert
    expect(result.blocks).toEqual([
      { taskId: 'a', interval: span(MONDAY, '20:00', '21:00'), workMinutes: 60, source: 'planner' },
      { taskId: null, interval: span(MONDAY, '21:00', '22:00'), workMinutes: 60, source: 'rest' },
    ]);
    expect(result.unscheduled).toEqual([{ taskId: 'b', missingMinutes: 60, reason: 'capacity' }]);
  });
});

describe('planSchedule: priorities and eviction (§6.5)', () => {
  it('should evict a less important task with an earlier deadline and report its work when it no longer fits', () => {
    // Arrange: working hours 08:00–10:00. By EDF "low" (due 09:00) goes first and takes 08:00–09:00.
    // "high" (priority 1, due 10:00) then fits only 60 of its 120 minutes, so it evicts "low".
    const input = plannerInput({
      dayEnd: '10:00',
      tasks: [
        task({
          id: 'low',
          priority: 3,
          deadline: at(MONDAY, '09:00'),
          workToPlan: 60,
          sessionMinutes: 60,
          createdAt: 1,
        }),
        task({
          id: 'high',
          priority: 1,
          deadline: at(MONDAY, '10:00'),
          workToPlan: 120,
          sessionMinutes: 120,
          createdAt: 2,
        }),
      ],
    });

    // Act
    const result = planSchedule(input);

    // Assert
    expect(result.blocks).toEqual([
      {
        taskId: 'high',
        interval: span(MONDAY, '08:00', '09:00'),
        workMinutes: 60,
        source: 'planner',
      },
      {
        taskId: 'high',
        interval: span(MONDAY, '09:00', '10:00'),
        workMinutes: 60,
        source: 'planner',
      },
    ]);
    expect(result.unscheduled).toEqual([{ taskId: 'low', missingMinutes: 60, reason: 'deadline' }]);
  });

  it('should not evict a task of the same priority', () => {
    // Arrange: the same situation, but both tasks have priority 1.
    const input = plannerInput({
      dayEnd: '10:00',
      tasks: [
        task({
          id: 'first',
          priority: 1,
          deadline: at(MONDAY, '09:00'),
          workToPlan: 60,
          sessionMinutes: 60,
          createdAt: 1,
        }),
        task({
          id: 'second',
          priority: 1,
          deadline: at(MONDAY, '10:00'),
          workToPlan: 120,
          sessionMinutes: 120,
          createdAt: 2,
        }),
      ],
    });

    // Act
    const result = planSchedule(input);

    // Assert
    expect(result.blocks).toEqual([
      {
        taskId: 'first',
        interval: span(MONDAY, '08:00', '09:00'),
        workMinutes: 60,
        source: 'planner',
      },
      {
        taskId: 'second',
        interval: span(MONDAY, '09:00', '10:00'),
        workMinutes: 60,
        source: 'planner',
      },
    ]);
    expect(result.unscheduled).toEqual([
      { taskId: 'second', missingMinutes: 60, reason: 'deadline' },
    ]);
  });

  it('should re-place evicted work where room is left and report only the rest', () => {
    // Arrange: working hours 08:00–10:00, only Monday and Tuesday free.
    // "low" (priority 3, due Tuesday 10:00) takes Monday; "high" (priority 1, no deadline) takes Tuesday,
    // still misses 60 minutes, evicts both "low" blocks and takes Monday 08:00–09:00.
    const input = plannerInput({
      dayEnd: '10:00',
      busy: [busy(at(WEDNESDAY, '00:00'), at('2026-10-20', '00:00'), 0)],
      tasks: [
        task({
          id: 'low',
          priority: 3,
          deadline: at(TUESDAY, '10:00'),
          workToPlan: 120,
          sessionMinutes: 60,
          createdAt: 1,
        }),
        task({ id: 'high', priority: 1, workToPlan: 180, sessionMinutes: 60, createdAt: 2 }),
      ],
    });

    // Act
    const result = planSchedule(input);

    // Assert: "low" gets back the hour that "high" did not need.
    expect(result.blocks).toEqual([
      {
        taskId: 'high',
        interval: span(MONDAY, '08:00', '09:00'),
        workMinutes: 60,
        source: 'planner',
      },
      {
        taskId: 'low',
        interval: span(MONDAY, '09:00', '10:00'),
        workMinutes: 60,
        source: 'planner',
      },
      {
        taskId: 'high',
        interval: span(TUESDAY, '08:00', '09:00'),
        workMinutes: 60,
        source: 'planner',
      },
      {
        taskId: 'high',
        interval: span(TUESDAY, '09:00', '10:00'),
        workMinutes: 60,
        source: 'planner',
      },
    ]);
    expect(result.unscheduled).toEqual([{ taskId: 'low', missingMinutes: 60, reason: 'deadline' }]);
  });

  it('should place the more important task first when deadlines are equal and both fit', () => {
    // Arrange: the priority-3 task is older, so only the priority key can put the other one first.
    const deadline = at(MONDAY, '22:00');
    const input = plannerInput({
      tasks: [
        task({ id: 'minor', priority: 3, deadline, workToPlan: 60, createdAt: 1 }),
        task({ id: 'major', priority: 1, deadline, workToPlan: 60, createdAt: 2 }),
      ],
    });

    // Act
    const result = planSchedule(input);

    // Assert
    expect(result.blocks.map((block) => block.taskId)).toEqual(['major', 'minor']);
  });
});

describe('planSchedule: queue order and report (§6.3 steps 5 and 7)', () => {
  it('should place the older task first when deadline and priority are equal', () => {
    const input = plannerInput({
      tasks: [
        task({ id: 'a', workToPlan: 60, createdAt: 2 }),
        task({ id: 'b', workToPlan: 60, createdAt: 1 }),
      ],
    });

    const result = planSchedule(input);

    expect(result.blocks.map((block) => block.taskId)).toEqual(['b', 'a']);
  });

  it('should report work without a deadline as capacity when the horizon is full', () => {
    const input = plannerInput({
      busy: [busy(at(MONDAY, '08:00'), at(MONDAY, '22:00'), 0), ONLY_MONDAY_FREE],
      tasks: [task({ id: 'a', workToPlan: 60 })],
    });

    const result = planSchedule(input);

    expect(result.blocks).toEqual([]);
    expect(result.unscheduled).toEqual([{ taskId: 'a', missingMinutes: 60, reason: 'capacity' }]);
  });

  it('should report all work as deadline when the deadline has already passed', () => {
    const input = plannerInput({
      tasks: [task({ id: 'late', workToPlan: 60, deadline: at(MONDAY, '07:00') })],
    });

    const result = planSchedule(input);

    expect(result.blocks).toEqual([]);
    expect(result.unscheduled).toEqual([
      { taskId: 'late', missingMinutes: 60, reason: 'deadline' },
    ]);
  });

  it('should ignore a task when it has no work to plan', () => {
    const input = plannerInput({ tasks: [task({ id: 'done', workToPlan: 0 })] });

    const result = planSchedule(input);

    expect(result).toEqual({ blocks: [], unscheduled: [] });
  });
});
