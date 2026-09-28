import { describe, expect, it } from 'vitest';

import { effectiveEnergyLimit, isStressMode, stressMultiplier } from '@/domain/energy';
import { planSchedule } from '@/domain/scheduler';
import type {
  BusyItem,
  Interval,
  PlannedBlock,
  PlannerInput,
  PlannerResult,
  PlannerTask,
  Priority,
} from '@/domain/types';

// The invariants of docs/algorithms.md §6.6, one test each. Every scenario is small enough to
// place by hand, and the expected blocks in the comments were computed that way.
// All dates are in October 2026 before the clock change on the 25th: Warsaw is UTC+2 there.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const MONDAY = '2026-10-05';
const TUESDAY = '2026-10-06';
const WEDNESDAY = '2026-10-07';

/** Warsaw wall-clock time as an instant (1–24 October 2026 only, UTC+2). */
function at(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00+02:00`);
}

/** The Warsaw date of an instant (1–24 October 2026 only, UTC+2). */
function dateOf(instant: number): string {
  return new Date(instant + 2 * HOUR).toISOString().slice(0, 10);
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

/** All new blocks of one task. */
function blocksOf(result: PlannerResult, taskId: string): PlannedBlock[] {
  return result.blocks.filter((block) => block.taskId === taskId);
}

// ── Independent checkers: written from the wording of each invariant, not from the planner's code.
// Each returns human-readable violations; an empty list means the invariant holds.

function intersects(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

function show(x: Interval): string {
  return `${new Date(x.start).toISOString()}–${new Date(x.end).toISOString()}`;
}

function energyOf(input: PlannerInput, block: PlannedBlock): number {
  return input.tasks.find((candidate) => candidate.id === block.taskId)?.energy ?? 0;
}

/** 1. New blocks overlap neither each other nor busy items. */
function overlapViolations(input: PlannerInput, result: PlannerResult): string[] {
  const violations: string[] = [];
  result.blocks.forEach((block, index) => {
    for (const other of result.blocks.slice(index + 1)) {
      if (intersects(block.interval, other.interval)) {
        violations.push(`blocks overlap: ${show(block.interval)} and ${show(other.interval)}`);
      }
    }
    for (const item of input.busy) {
      if (intersects(block.interval, item.interval)) {
        violations.push(`block ${show(block.interval)} overlaps busy ${show(item.interval)}`);
      }
    }
  });
  return violations;
}

/** 2. Every new block lies inside its day's working hours and starts and ends on the 15-minute grid. */
function windowAndGridViolations(input: PlannerInput, result: PlannerResult): string[] {
  const violations: string[] = [];
  for (const { interval } of result.blocks) {
    const date = dateOf(interval.start);
    if (interval.start < at(date, input.dayStart) || interval.end > at(date, input.dayEnd)) {
      violations.push(`outside working hours: ${show(interval)}`);
    }
    if (interval.start % (15 * MINUTE) !== 0 || interval.end % (15 * MINUTE) !== 0) {
      violations.push(`off the grid: ${show(interval)}`);
    }
  }
  return violations;
}

/** 3. No new block ends after its task's deadline. */
function deadlineViolations(input: PlannerInput, result: PlannerResult): string[] {
  return result.blocks
    .filter((block) => {
      const deadline =
        input.tasks.find((candidate) => candidate.id === block.taskId)?.deadline ?? null;
      return deadline !== null && block.interval.end > deadline;
    })
    .map((block) => `ends after the deadline: ${block.taskId ?? 'rest'} ${show(block.interval)}`);
}

/** 4. On every day that got new work costing energy, busy + new load ≤ the limit (in energy-minutes). */
function loadViolations(input: PlannerInput, result: PlannerResult): string[] {
  const violations: string[] = [];
  const dates = new Set(result.blocks.map((block) => dateOf(block.interval.start)));
  for (const date of dates) {
    const day = { start: at(date, '00:00'), end: at(date, '00:00') + 24 * HOUR };
    let newLoad = 0;
    for (const block of result.blocks.filter(
      (candidate) => dateOf(candidate.interval.start) === date,
    )) {
      newLoad += ((block.interval.end - block.interval.start) / MINUTE) * energyOf(input, block);
    }
    let busyLoad = 0;
    for (const item of input.busy) {
      const overlap =
        Math.min(item.interval.end, day.end) - Math.max(item.interval.start, day.start);
      busyLoad += Math.max(0, overlap / MINUTE) * item.energy;
    }
    if (newLoad > 0 && busyLoad + newLoad > input.energyLimit * 60) {
      violations.push(`${date}: ${(busyLoad + newLoad) / 60} points > ${input.energyLimit}`);
    }
  }
  return violations;
}

/** 5. No chain of demanding work (gaps < 20 min) that contains a new block is longer than 120 min. */
function heavyChainViolations(input: PlannerInput, result: PlannerResult): string[] {
  const pieces = [
    ...input.busy
      .filter((item) => item.energy >= 2)
      .map((item) => ({ ...item.interval, isNew: false })),
    ...result.blocks
      .filter((block) => energyOf(input, block) >= 2)
      .map((block) => ({ ...block.interval, isNew: true })),
  ].sort((a, b) => a.start - b.start);
  const chains: { start: number; end: number; hasNew: boolean }[] = [];
  for (const piece of pieces) {
    const last = chains.at(-1);
    if (last !== undefined && piece.start - last.end < 20 * MINUTE) {
      last.end = Math.max(last.end, piece.end);
      last.hasNew = last.hasNew || piece.isNew;
    } else {
      chains.push({ start: piece.start, end: piece.end, hasNew: piece.isNew });
    }
  }
  return chains
    .filter((chain) => chain.hasNew && chain.end - chain.start > 120 * MINUTE)
    .map((chain) => `demanding chain of ${(chain.end - chain.start) / MINUTE} min: ${show(chain)}`);
}

/**
 * 6. A day that got a new block of a task has at most two blocks of that task,
 * counting the task's fixed (busy) blocks too; a block belongs to the date it starts on.
 */
function sessionViolations(input: PlannerInput, result: PlannerResult): string[] {
  const newCounts = new Map<string, number>();
  for (const block of result.blocks) {
    if (block.taskId !== null) {
      const key = `${block.taskId} on ${dateOf(block.interval.start)}`;
      newCounts.set(key, (newCounts.get(key) ?? 0) + 1);
    }
  }
  const fixedCounts = new Map<string, number>();
  for (const item of input.busy) {
    const taskId = item.taskId ?? null;
    if (taskId !== null) {
      const key = `${taskId} on ${dateOf(item.interval.start)}`;
      fixedCounts.set(key, (fixedCounts.get(key) ?? 0) + 1);
    }
  }
  return [...newCounts]
    .map(([key, count]) => ({ key, total: count + (fixedCounts.get(key) ?? 0) }))
    .filter(({ total }) => total > 2)
    .map(({ key, total }) => `${total} blocks of ${key}`);
}

/** 7. For every task: work of its blocks + missing minutes = workToPlan. */
function workViolations(input: PlannerInput, result: PlannerResult): string[] {
  return input.tasks.flatMap((candidate) => {
    const placed = blocksOf(result, candidate.id).reduce(
      (sum, block) => sum + block.workMinutes,
      0,
    );
    const missing =
      result.unscheduled.find((entry) => entry.taskId === candidate.id)?.missingMinutes ?? 0;
    return placed + missing === candidate.workToPlan
      ? []
      : [`${candidate.id}: placed ${placed} + missing ${missing} ≠ ${candidate.workToPlan}`];
  });
}

/** A fortnight with school every weekday, two evening trainings a week and 30 varied tasks. */
function crowdedFortnight(): PlannerInput {
  const lessons = [
    ['08:00', '08:45'],
    ['08:55', '09:40'],
    ['09:50', '10:35'],
    ['10:55', '11:40'],
    ['11:50', '12:35'],
    ['12:45', '13:30'],
  ] as const;
  const schoolDays = ['05', '06', '07', '08', '09', '12', '13', '14', '15', '16'];
  const busyItems: BusyItem[] = [];
  for (const day of schoolDays) {
    for (const [start, end] of lessons) {
      busyItems.push(busy(at(`2026-10-${day}`, start), at(`2026-10-${day}`, end), 2));
    }
  }
  for (const day of ['06', '08', '13', '15']) {
    busyItems.push(busy(at(`2026-10-${day}`, '18:00'), at(`2026-10-${day}`, '19:30'), 1));
  }
  // Blocks the user pinned: they use up sessions of their tasks on those days.
  const pinned = [
    { taskId: 'task-03', date: '2026-10-06', start: '15:00', end: '16:00', energy: 3 },
    { taskId: 'task-07', date: '2026-10-07', start: '16:00', end: '17:00', energy: 3 },
    { taskId: 'task-10', date: '2026-10-08', start: '15:00', end: '16:30', energy: 2 },
  ];
  for (const block of pinned) {
    const interval = { start: at(block.date, block.start), end: at(block.date, block.end) };
    busyItems.push({ interval, energy: block.energy, taskId: block.taskId });
  }
  const priorities: readonly Priority[] = [1, 2, 3];
  const paces = [0.8, 1.0, 1.2, 1.5];
  const sessions = [null, 45, 60, 90, 120];
  const tasks: PlannerTask[] = [];
  for (let i = 0; i < 30; i += 1) {
    const deadlineDay = String(6 + (i % 13)).padStart(2, '0');
    tasks.push(
      task({
        id: `task-${String(i).padStart(2, '0')}`,
        priority: priorities[i % 3] ?? 2,
        deadline: i % 4 === 0 ? null : at(`2026-10-${deadlineDay}`, '20:00'),
        createdAt: i,
        energy: i % 4,
        workToPlan: 60 + ((i * 37) % 300),
        pace: paces[i % 4] ?? 1,
        sessionMinutes: sessions[i % 5] ?? null,
      }),
    );
  }
  return plannerInput({ busy: busyItems, tasks, energyLimit: 16, stressMode: true });
}

describe('planSchedule invariants (docs/algorithms.md §6.6)', () => {
  it('1: should overlap neither busy items nor other new blocks when the day is partly busy', () => {
    // Arrange: lessons 08:00–09:00 and 10:00–12:00, three light tasks in creation order.
    const input = plannerInput({
      busy: [
        busy(at(MONDAY, '08:00'), at(MONDAY, '09:00'), 2),
        busy(at(MONDAY, '10:00'), at(MONDAY, '12:00'), 2),
        ONLY_MONDAY_FREE,
      ],
      tasks: [
        task({ id: 'a', workToPlan: 60, sessionMinutes: 60, createdAt: 1 }),
        task({ id: 'b', workToPlan: 90, createdAt: 2 }),
        task({ id: 'c', workToPlan: 45, sessionMinutes: 45, createdAt: 3 }),
      ],
    });

    // Act
    const result = planSchedule(input);

    // Assert: a fills the gap 09:00–10:00, b and c follow the second lesson back to back.
    expect(overlapViolations(input, result)).toEqual([]);
    expect(result.blocks.map((block) => block.interval)).toEqual([
      span(MONDAY, '09:00', '10:00'),
      span(MONDAY, '12:00', '13:30'),
      span(MONDAY, '13:30', '14:15'),
    ]);
    expect(result.unscheduled).toEqual([]);
  });

  it('2: should keep every block inside working hours and on the 15-minute grid', () => {
    // Arrange: planning starts at 05:15, long before 08:00; the first busy item ends off the grid.
    const input = plannerInput({
      now: at(MONDAY, '05:00'),
      busy: [
        busy(at(MONDAY, '08:00'), at(MONDAY, '09:10'), 0),
        busy(at(MONDAY, '10:15'), at(MONDAY, '21:15'), 0),
        ONLY_MONDAY_FREE,
      ],
      tasks: [
        task({ id: 'a', workToPlan: 60, createdAt: 1 }),
        task({ id: 'b', workToPlan: 45, sessionMinutes: 45, createdAt: 2 }),
      ],
    });

    // Act
    const result = planSchedule(input);

    // Assert: a waits for 09:15 (not 09:10), b ends exactly at the end of the working day.
    expect(windowAndGridViolations(input, result)).toEqual([]);
    expect(result.blocks.map((block) => block.interval)).toEqual([
      span(MONDAY, '09:15', '10:15'),
      span(MONDAY, '21:15', '22:00'),
    ]);
  });

  it('3: should never end a block after its deadline, and still place the work that fits before it', () => {
    // Arrange: busy until 09:00, deadline 10:00, 120 minutes of work in 120-minute sessions.
    const input = plannerInput({
      busy: [busy(at(MONDAY, '08:00'), at(MONDAY, '09:00'), 0), ONLY_MONDAY_FREE],
      tasks: [
        task({ id: 'essay', workToPlan: 120, sessionMinutes: 120, deadline: at(MONDAY, '10:00') }),
      ],
    });

    // Act
    const result = planSchedule(input);

    // Assert: 09:00–11:00 would cross the deadline, so only a 60-minute half fits.
    expect(deadlineViolations(input, result)).toEqual([]);
    expect(result.blocks).toEqual([
      {
        taskId: 'essay',
        interval: span(MONDAY, '09:00', '10:00'),
        workMinutes: 60,
        source: 'planner',
      },
    ]);
    expect(result.unscheduled).toEqual([
      { taskId: 'essay', missingMinutes: 60, reason: 'deadline' },
    ]);
  });

  it('4: should keep every day within the energy limit by moving work to later days', () => {
    // Arrange: limit 2 points; a 90-minute block of energy 1 costs 1.5 points.
    const input = plannerInput({
      energyLimit: 2,
      tasks: [task({ id: 'cleanup', workToPlan: 240, energy: 1 })],
    });

    // Act
    const result = planSchedule(input);

    // Assert: 1.5 + 1.5 = 3 > 2, so each day gets one block; the last 60 minutes (1 point) go to Wednesday.
    expect(loadViolations(input, result)).toEqual([]);
    expect(result.blocks.map((block) => block.interval)).toEqual([
      span(MONDAY, '08:00', '09:30'),
      span(TUESDAY, '08:00', '09:30'),
      span(WEDNESDAY, '08:00', '09:00'),
    ]);
  });

  it('4: should give a day already over the limit no work that costs energy, but allow work that costs none', () => {
    // Arrange: 3 hours of school (energy 2) = 6 points on Monday, limit 4.
    const input = plannerInput({
      energyLimit: 4,
      busy: [busy(at(MONDAY, '08:00'), at(MONDAY, '11:00'), 2)],
      tasks: [
        task({ id: 'light', workToPlan: 60, energy: 1, createdAt: 1 }),
        task({ id: 'restful', workToPlan: 60, energy: 0, createdAt: 2 }),
      ],
    });

    // Act
    const result = planSchedule(input);

    // Assert
    expect(loadViolations(input, result)).toEqual([]);
    expect(blocksOf(result, 'light').map((block) => block.interval)).toEqual([
      span(TUESDAY, '08:00', '09:00'),
    ]);
    expect(blocksOf(result, 'restful').map((block) => block.interval)).toEqual([
      span(MONDAY, '11:00', '12:00'),
    ]);
  });

  it('5: should break a chain of new demanding blocks before it exceeds 120 minutes', () => {
    // Arrange: two demanding tasks (energy 3) of one 90-minute session each.
    const input = plannerInput({
      busy: [ONLY_MONDAY_FREE],
      tasks: [
        task({ id: 'math', workToPlan: 90, energy: 3, createdAt: 1 }),
        task({ id: 'physics', workToPlan: 90, energy: 3, createdAt: 2 }),
      ],
    });

    // Act
    const result = planSchedule(input);

    // Assert: 09:30 would make 180 min in a row, 09:45 leaves only 15 min of break; 10:00 is the first valid start.
    expect(heavyChainViolations(input, result)).toEqual([]);
    expect(result.blocks.map((block) => block.interval)).toEqual([
      span(MONDAY, '08:00', '09:30'),
      span(MONDAY, '10:00', '11:30'),
    ]);
  });

  it('5: should count a demanding lesson into the chain when a new block would follow it', () => {
    // Arrange: a 60-minute lesson of energy 2 at 08:00.
    const input = plannerInput({
      busy: [busy(at(MONDAY, '08:00'), at(MONDAY, '09:00'), 2), ONLY_MONDAY_FREE],
      tasks: [task({ id: 'math', workToPlan: 90, energy: 3 })],
    });

    // Act
    const result = planSchedule(input);

    // Assert: 09:00 → 150 min in a row, 09:15 → 15-min break only; 09:30 leaves a real break.
    expect(heavyChainViolations(input, result)).toEqual([]);
    expect(result.blocks.map((block) => block.interval)).toEqual([span(MONDAY, '09:30', '11:00')]);
  });

  it('6: should place at most two blocks of one task per day', () => {
    // Arrange: three sessions of light work, room for all of them on Monday.
    const input = plannerInput({ tasks: [task({ id: 'reading', workToPlan: 270 })] });

    // Act
    const result = planSchedule(input);

    // Assert: the third session moves to Tuesday.
    expect(sessionViolations(input, result)).toEqual([]);
    expect(result.blocks.map((block) => block.interval)).toEqual([
      span(MONDAY, '08:00', '09:30'),
      span(MONDAY, '09:30', '11:00'),
      span(TUESDAY, '08:00', '09:30'),
    ]);
  });

  it('6: should count a pinned block of the task toward its two blocks a day', () => {
    // Arrange: the user pinned a "reading" block on Monday 12:00–13:00; a lesson and a pinned
    // block of another task on Monday must not count.
    const input = plannerInput({
      busy: [
        { interval: span(MONDAY, '12:00', '13:00'), energy: 1, taskId: 'reading' },
        { interval: span(MONDAY, '13:00', '14:00'), energy: 1, taskId: 'other' },
        { interval: span(MONDAY, '14:00', '15:00'), energy: 2, taskId: null },
      ],
      tasks: [task({ id: 'reading', workToPlan: 270 })],
    });

    // Act
    const result = planSchedule(input);

    // Assert: pinned + one new block = 2 on Monday, so the other two sessions go to Tuesday.
    expect(sessionViolations(input, result)).toEqual([]);
    expect(result.blocks.map((block) => block.interval)).toEqual([
      span(MONDAY, '08:00', '09:30'),
      span(TUESDAY, '08:00', '09:30'),
      span(TUESDAY, '09:30', '11:00'),
    ]);
  });

  it('7: should neither lose nor invent work when blocks are evicted, halved and stretched by pace', () => {
    // Arrange: working hours 08:00–10:00 only.
    // low (priority 3, due Mon 09:00, pace 1.5): 40 min of work → a 60-minute block at 08:00.
    // high (priority 1, due Mon 10:00): its 120 min fit only after evicting low.
    // other (priority 2, no deadline, pace 1.2): 50 min of work per 60-minute block, on Tuesday.
    const input = plannerInput({
      dayEnd: '10:00',
      tasks: [
        task({
          id: 'low',
          priority: 3,
          deadline: at(MONDAY, '09:00'),
          workToPlan: 40,
          pace: 1.5,
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
        task({
          id: 'other',
          priority: 2,
          workToPlan: 100,
          pace: 1.2,
          sessionMinutes: 60,
          createdAt: 3,
        }),
      ],
    });

    // Act
    const result = planSchedule(input);

    // Assert
    expect(workViolations(input, result)).toEqual([]);
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
      {
        taskId: 'other',
        interval: span(TUESDAY, '08:00', '09:00'),
        workMinutes: 50,
        source: 'planner',
      },
      {
        taskId: 'other',
        interval: span(TUESDAY, '09:00', '10:00'),
        workMinutes: 50,
        source: 'planner',
      },
    ]);
    expect(result.unscheduled).toEqual([{ taskId: 'low', missingMinutes: 40, reason: 'deadline' }]);
  });

  it('8: should return equal plans when run twice on the same input', () => {
    // Arrange
    const input = crowdedFortnight();

    // Act
    const first = planSchedule(input);
    const second = planSchedule(input);

    // Assert
    expect(second).toEqual(first);
  });

  it('8: should return the same plan when tasks and busy items arrive in a different order', () => {
    // Arrange: the tasks differ only by id, so only the last sort key can order them.
    const lesson = busy(at(MONDAY, '12:00'), at(MONDAY, '13:00'), 2);
    const tasks = [task({ id: 'task-b', workToPlan: 60 }), task({ id: 'task-a', workToPlan: 60 })];
    const input = plannerInput({ busy: [lesson, ONLY_MONDAY_FREE], tasks });
    const shuffled = plannerInput({
      busy: [ONLY_MONDAY_FREE, lesson],
      tasks: [...tasks].reverse(),
    });

    // Act
    const result = planSchedule(input);
    const resultShuffled = planSchedule(shuffled);

    // Assert
    expect(resultShuffled).toEqual(result);
    expect(result.blocks.map((block) => block.taskId)).toEqual(['task-a', 'task-b']);
  });

  it('9: should place priority 1 and report priority 3 when the day fits only one of two tasks with the same deadline', () => {
    // Arrange: two free hours; each task needs both. The priority-3 task is older.
    const deadline = at(MONDAY, '22:00');
    const input = plannerInput({
      busy: [busy(at(MONDAY, '10:00'), at(MONDAY, '22:00'), 0), ONLY_MONDAY_FREE],
      tasks: [
        task({
          id: 'minor',
          priority: 3,
          deadline,
          workToPlan: 120,
          sessionMinutes: 120,
          createdAt: 1,
        }),
        task({
          id: 'major',
          priority: 1,
          deadline,
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
        taskId: 'major',
        interval: span(MONDAY, '08:00', '10:00'),
        workMinutes: 120,
        source: 'planner',
      },
    ]);
    expect(result.unscheduled).toEqual([
      { taskId: 'minor', missingMinutes: 120, reason: 'deadline' },
    ]);
  });

  it('10: should place the task with the earlier deadline first when priorities are equal', () => {
    // Arrange: the later-deadline task is older and listed first.
    const input = plannerInput({
      tasks: [
        task({
          id: 'due-wednesday',
          deadline: at(WEDNESDAY, '22:00'),
          workToPlan: 60,
          createdAt: 1,
        }),
        task({ id: 'due-tuesday', deadline: at(TUESDAY, '22:00'), workToPlan: 60, createdAt: 2 }),
      ],
    });

    // Act
    const result = planSchedule(input);

    // Assert
    expect(blocksOf(result, 'due-tuesday').map((block) => block.interval)).toEqual([
      span(MONDAY, '08:00', '09:00'),
    ]);
    expect(blocksOf(result, 'due-wednesday').map((block) => block.interval)).toEqual([
      span(MONDAY, '09:00', '10:00'),
    ]);
  });

  it('11: should reserve recovery in every day with a free hour and plan within the lowered limit', () => {
    // Arrange: a week at its worst → overload 5 → multiplier 0.6 → limit round(20 · 0.6) = 12.
    const multiplier = stressMultiplier({
      weekly: { fatigue: 5, stress: 5, focus: 1, distractions: 5 },
      daily: { done: 10, missed: 0, meanPaceSample: 1.0 },
    });
    const energyLimit = effectiveEnergyLimit(20, multiplier);
    expect(multiplier).toBe(0.6);
    expect(energyLimit).toBe(12);
    // Wednesday leaves only 30 free minutes. Three demanding tasks would fill 18 points on Monday at limit 20.
    const tasks = [1, 2, 3].map((n) =>
      task({ id: `heavy-${n}`, workToPlan: 360, energy: 3, createdAt: n }),
    );
    const input = plannerInput({
      energyLimit,
      stressMode: isStressMode(multiplier),
      busy: [busy(at(WEDNESDAY, '08:00'), at(WEDNESDAY, '21:30'), 0)],
      tasks,
    });

    // Act
    const result = planSchedule(input);

    // Assert: 14 days (5–18 October) minus Wednesday = 13 recovery blocks, each in the last hour of the day.
    const recovery = result.blocks.filter((block) => block.source === 'rest');
    expect(recovery).toHaveLength(13);
    for (const block of recovery) {
      const date = dateOf(block.interval.start);
      expect(date).not.toBe(WEDNESDAY);
      expect(block).toEqual({
        taskId: null,
        interval: span(date, '21:00', '22:00'),
        workMinutes: 60,
        source: 'rest',
      });
    }
    expect(loadViolations(input, result)).toEqual([]);
    const unstressed = planSchedule({ ...input, energyLimit: 20, stressMode: false });
    expect(loadViolations({ ...input, energyLimit: 12 }, unstressed)).not.toEqual([]);
  });

  it('1–7: should keep every invariant on a crowded fortnight of 30 tasks', () => {
    // Arrange
    const input = crowdedFortnight();

    // Act
    const result = planSchedule(input);

    // Assert
    expect(result.blocks.length).toBeGreaterThan(50);
    expect(result.unscheduled.length).toBeGreaterThan(0);
    expect(overlapViolations(input, result)).toEqual([]);
    expect(windowAndGridViolations(input, result)).toEqual([]);
    expect(deadlineViolations(input, result)).toEqual([]);
    expect(loadViolations(input, result)).toEqual([]);
    expect(heavyChainViolations(input, result)).toEqual([]);
    expect(sessionViolations(input, result)).toEqual([]);
    expect(workViolations(input, result)).toEqual([]);
  });
});

describe('planSchedule termination and speed', () => {
  it('should plan 30 tasks over a crowded fortnight in under 200 ms', () => {
    // Arrange
    const input = crowdedFortnight();
    planSchedule(input); // warm-up: the first call also pays for loading and compiling the code

    // Act
    const startedAt = performance.now();
    const result = planSchedule(input);
    const elapsedMs = performance.now() - startedAt;

    // Assert
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(200);
  });
});
