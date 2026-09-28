import { describe, expect, it } from 'vitest';

import { buildPlanContext, planningHorizon } from '@/domain/scheduler/horizon';
import type { PlannerInput, PlannerTask } from '@/domain/types';

/** Warsaw wall-clock time as an instant (1–24 October 2026 only, UTC+2). */
function at(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00+02:00`);
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

function plannerInput(fields: Partial<PlannerInput>): PlannerInput {
  return {
    now: at('2026-10-05', '07:45'),
    timezone: 'Europe/Warsaw',
    dayStart: '08:00',
    dayEnd: '22:00',
    energyLimit: 20,
    stressMode: false,
    busy: [],
    tasks: [],
    ...fields,
  };
}

describe('planningHorizon', () => {
  it('should start at now + 15 minutes on the grid and last 14 days when no deadline is later', () => {
    // 05:52Z + 15 min = 06:07Z → 06:15Z.
    const horizon = planningHorizon(Date.parse('2026-10-05T05:52:00Z'), []);

    expect(horizon).toEqual({
      start: Date.parse('2026-10-05T06:15:00Z'),
      end: Date.parse('2026-10-19T06:15:00Z'),
    });
  });

  it('should end at the farthest deadline when it is more than 14 days away', () => {
    const tasks = [
      task({ id: 'a', deadline: Date.parse('2026-10-25T12:00:00Z') }),
      task({ id: 'b', deadline: Date.parse('2026-10-22T12:00:00Z') }),
    ];

    const horizon = planningHorizon(Date.parse('2026-10-05T06:00:00Z'), tasks);

    expect(horizon.end).toBe(Date.parse('2026-10-25T12:00:00Z'));
  });

  it('should end 60 days after the start when the farthest deadline is later', () => {
    const tasks = [task({ id: 'a', deadline: Date.parse('2027-01-10T12:00:00Z') })];

    const horizon = planningHorizon(Date.parse('2026-10-05T05:45:00Z'), tasks);

    expect(horizon.end).toBe(Date.parse('2026-12-04T06:00:00Z'));
  });

  it('should ignore the deadline of a task that has no work left', () => {
    const tasks = [
      task({ id: 'done', workToPlan: 0, deadline: Date.parse('2026-11-30T12:00:00Z') }),
    ];

    const horizon = planningHorizon(Date.parse('2026-10-05T05:45:00Z'), tasks);

    expect(horizon.end).toBe(Date.parse('2026-10-19T06:00:00Z'));
  });
});

describe('buildPlanContext', () => {
  it('should build one working window per local date of the horizon', () => {
    // Arrange: the horizon runs from Monday 08:00 to 19 October 08:00, where the window would be empty.
    const input = plannerInput({});
    const horizon = planningHorizon(input.now, input.tasks);

    // Act
    const { days } = buildPlanContext(input, horizon);

    // Assert
    expect(days).toHaveLength(14);
    expect(days[0]?.date).toBe('2026-10-05');
    expect(days[0]?.window).toEqual({
      start: at('2026-10-05', '08:00'),
      end: at('2026-10-05', '22:00'),
    });
    expect(days[13]?.window).toEqual({
      start: at('2026-10-18', '08:00'),
      end: at('2026-10-18', '22:00'),
    });
  });

  it('should cut the first window at the start of the horizon', () => {
    const input = plannerInput({ now: at('2026-10-05', '12:00') });
    const horizon = planningHorizon(input.now, input.tasks);

    const { days } = buildPlanContext(input, horizon);

    expect(days[0]?.window).toEqual({
      start: at('2026-10-05', '12:15'),
      end: at('2026-10-05', '22:00'),
    });
  });

  it('should count busy load per calendar day and keep only busy intervals inside the window', () => {
    // Arrange: a 06:00–07:00 training (energy 3) and a 23:00–01:00 party (energy 1) across midnight.
    const training = {
      interval: { start: at('2026-10-05', '06:00'), end: at('2026-10-05', '07:00') },
      energy: 3,
    };
    const party = {
      interval: { start: at('2026-10-05', '23:00'), end: at('2026-10-06', '01:00') },
      energy: 1,
    };
    const input = plannerInput({ busy: [training, party] });
    const horizon = planningHorizon(input.now, input.tasks);

    // Act
    const { days } = buildPlanContext(input, horizon);

    // Assert: Monday 60·3 + 60·1 = 240 energy-minutes, Tuesday 60·1 = 60; neither item is in working hours.
    expect(days[0]?.busyLoad).toBe(240);
    expect(days[1]?.busyLoad).toBe(60);
    expect(days[0]?.busy).toEqual([]);
  });

  it('should give each fixed task block to the date it starts on', () => {
    // Arrange: an "essay" block at noon, one from 23:30 into Tuesday, a lesson without a task.
    const noon = {
      interval: { start: at('2026-10-05', '12:00'), end: at('2026-10-05', '13:00') },
      energy: 3,
      taskId: 'essay',
    };
    const lateNight = {
      interval: { start: at('2026-10-05', '23:30'), end: at('2026-10-06', '00:30') },
      energy: 3,
      taskId: 'essay',
    };
    const lesson = {
      interval: { start: at('2026-10-06', '08:00'), end: at('2026-10-06', '08:45') },
      energy: 2,
      taskId: null,
    };
    const input = plannerInput({ busy: [noon, lateNight, lesson] });
    const horizon = planningHorizon(input.now, input.tasks);

    // Act
    const { days } = buildPlanContext(input, horizon);

    // Assert: both essay blocks start on Monday; Tuesday has no task blocks.
    expect(days[0]?.busyTaskIds).toEqual(['essay', 'essay']);
    expect(days[1]?.busyTaskIds).toEqual([]);
  });

  it('should keep only demanding busy work near the horizon for chains', () => {
    const lessonToday = {
      interval: { start: at('2026-10-05', '07:00'), end: at('2026-10-05', '07:45') },
      energy: 2,
    };
    const lessonLastMonth = {
      interval: { start: at('2026-09-07', '08:00'), end: at('2026-09-07', '09:00') },
      energy: 3,
    };
    const walkToday = {
      interval: { start: at('2026-10-05', '12:00'), end: at('2026-10-05', '13:00') },
      energy: 1,
    };
    const input = plannerInput({ busy: [lessonToday, lessonLastMonth, walkToday] });
    const horizon = planningHorizon(input.now, input.tasks);

    const { heavyBusy } = buildPlanContext(input, horizon);

    expect(heavyBusy).toEqual([lessonToday.interval]);
  });

  it('should express the energy limit in energy-minutes', () => {
    const input = plannerInput({ energyLimit: 12 });
    const horizon = planningHorizon(input.now, input.tasks);

    expect(buildPlanContext(input, horizon).dayCapacity).toBe(720);
  });
});
