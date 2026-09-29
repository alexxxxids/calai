import { describe, expect, it } from 'vitest';

import { buildPlannerInput } from './build-input';
import type { PlannerData } from './types';

const BASE_PROFILE = {
  id: 'user-1',
  timezone: 'Europe/Warsaw',
  day_start: '08:00:00',
  day_end: '20:00:00',
  daily_energy_limit: 20,
  reflection_level: 'analytic' as const,
};

const BASE_TASK_TYPES = [
  { id: 'type-study', name: 'Nauka', energy: 3, is_rest: false, is_one_off: false },
  { id: 'type-school', name: 'Szkoła', energy: 2, is_rest: false, is_one_off: false },
  { id: 'type-work', name: 'Praca', energy: 2, is_rest: false, is_one_off: false },
  { id: 'type-rest', name: 'Odpoczynek', energy: 0, is_rest: true, is_one_off: false },
];

function createBasePlannerData(overrides: Partial<PlannerData> = {}): PlannerData {
  return {
    profile: { ...BASE_PROFILE, ...overrides.profile },
    taskTypes: overrides.taskTypes ?? BASE_TASK_TYPES,
    tasks: overrides.tasks ?? [],
    blocks: overrides.blocks ?? [],
    recurringEvents: overrides.recurringEvents ?? [],
    subscriptions: overrides.subscriptions ?? [],
    externalEvents: overrides.externalEvents ?? [],
    latestReflection: overrides.latestReflection ?? null,
  };
}

describe('buildPlannerInput', () => {
  it('should correctly isolate busy items and filter out events before start of local today', () => {
    // Arrange: 2026-10-15T12:00:00Z in Europe/Warsaw (UTC+2) is 14:00 on 2026-10-15.
    // Local today start is 2026-10-14T22:00:00Z.
    const now = new Date('2026-10-15T12:00:00Z');
    const data = createBasePlannerData({
      tasks: [
        {
          id: 'task-1',
          type_id: 'type-school',
          notes: null,
          priority: 2,
          fixation: 'flexible',
          estimate_minutes: 120,
          session_minutes: 60,
          deadline: null,
          created_at: '2026-10-10T10:00:00Z',
          status: 'active',
        },
      ],
      blocks: [
        // Block 1: Ended yesterday before start of local today -> must be filtered out
        {
          id: 'block-yesterday',
          task_id: 'task-1',
          starts_at: '2026-10-14T18:00:00Z',
          ends_at: '2026-10-14T20:00:00Z',
          work_minutes: 60,
          status: 'done',
          source: 'manual',
          pinned: false,
          actual_minutes: 60,
          closed_at: '2026-10-14T20:00:00Z',
        },
        // Block 2: Done earlier today -> must be included in busy with task ID
        {
          id: 'block-earlier-today',
          task_id: 'task-1',
          starts_at: '2026-10-15T06:00:00Z',
          ends_at: '2026-10-15T07:30:00Z',
          work_minutes: 90,
          status: 'done',
          source: 'manual',
          pinned: false,
          actual_minutes: 90,
          closed_at: '2026-10-15T07:30:00Z',
        },
      ],
      subscriptions: [
        { id: 'sub-1', type_id: 'type-work' },
      ],
      externalEvents: [
        // Event 1: External event earlier today -> must be included in busy with type energy
        {
          id: 'ext-1',
          subscription_id: 'sub-1',
          starts_at: '2026-10-15T08:00:00Z',
          ends_at: '2026-10-15T09:00:00Z',
          title: 'Spotkanie',
        },
      ],
    });

    // Act
    const result = buildPlannerInput(data, now);

    // Assert
    expect(result.input.busy).toHaveLength(2);
    expect(result.input.busy[0]).toEqual({
      interval: {
        start: new Date('2026-10-15T06:00:00Z').getTime(),
        end: new Date('2026-10-15T07:30:00Z').getTime(),
      },
      energy: 2,
      taskId: 'task-1',
    });
    expect(result.input.busy[1]).toEqual({
      interval: {
        start: new Date('2026-10-15T08:00:00Z').getTime(),
        end: new Date('2026-10-15T09:00:00Z').getTime(),
      },
      energy: 2,
    });
  });

  it('should identify exactly removable future unpinned planned blocks and rest blocks', () => {
    // Arrange: now is 12:00:00Z. Start buffer is 15 min, so cutoff is 12:15:00Z.
    const now = new Date('2026-10-15T12:00:00Z');
    const data = createBasePlannerData({
      tasks: [
        {
          id: 'task-flex',
          type_id: 'type-study',
          notes: null,
          priority: 1,
          fixation: 'flexible',
          estimate_minutes: 180,
          session_minutes: 90,
          deadline: null,
          created_at: '2026-10-10T10:00:00Z',
          status: 'active',
        },
      ],
      blocks: [
        // Removable 1: unpinned planned block of flexible task, 2h in future
        {
          id: 'block-removable-task',
          task_id: 'task-flex',
          starts_at: '2026-10-15T14:00:00Z',
          ends_at: '2026-10-15T15:30:00Z',
          work_minutes: 90,
          status: 'planned',
          source: 'planner',
          pinned: false,
          actual_minutes: null,
          closed_at: null,
        },
        // Removable 2: unpinned rest block in future
        {
          id: 'block-removable-rest',
          task_id: null,
          starts_at: '2026-10-15T17:00:00Z',
          ends_at: '2026-10-15T18:00:00Z',
          work_minutes: 60,
          status: 'planned',
          source: 'rest',
          pinned: false,
          actual_minutes: null,
          closed_at: null,
        },
      ],
    });

    // Act
    const result = buildPlannerInput(data, now);

    // Assert
    expect(result.removeBlockIds).toEqual(['block-removable-task', 'block-removable-rest']);
    // Since both blocks are future removable, neither is placed in busy
    expect(result.input.busy).toHaveLength(0);
  });

  it('should not remove pinned blocks, past blocks, or blocks of hard tasks', () => {
    // Arrange: now is 12:00:00Z. Cutoff is 12:15:00Z.
    const now = new Date('2026-10-15T12:00:00Z');
    const data = createBasePlannerData({
      tasks: [
        {
          id: 'task-flex',
          type_id: 'type-study',
          notes: null,
          priority: 2,
          fixation: 'flexible',
          estimate_minutes: 180,
          session_minutes: 90,
          deadline: null,
          created_at: '2026-10-10T10:00:00Z',
          status: 'active',
        },
        {
          id: 'task-hard',
          type_id: 'type-school',
          notes: null,
          priority: 1,
          fixation: 'hard',
          estimate_minutes: 60,
          session_minutes: 60,
          deadline: null,
          created_at: '2026-10-10T10:00:00Z',
          status: 'active',
        },
      ],
      blocks: [
        // 1. Pinned future block of flexible task -> kept in busy, NOT removed
        {
          id: 'block-pinned',
          task_id: 'task-flex',
          starts_at: '2026-10-15T14:00:00Z',
          ends_at: '2026-10-15T15:30:00Z',
          work_minutes: 90,
          status: 'planned',
          source: 'manual',
          pinned: true,
          actual_minutes: null,
          closed_at: null,
        },
        // 2. Past block completed earlier today -> kept in busy, NOT removed
        {
          id: 'block-past',
          task_id: 'task-flex',
          starts_at: '2026-10-15T09:00:00Z',
          ends_at: '2026-10-15T10:00:00Z',
          work_minutes: 60,
          status: 'done',
          source: 'planner',
          pinned: false,
          actual_minutes: 60,
          closed_at: '2026-10-15T10:00:00Z',
        },
        // 3. Block starting in 5 minutes (within 15 min buffer) -> kept in busy, NOT removed
        {
          id: 'block-in-buffer',
          task_id: 'task-flex',
          starts_at: '2026-10-15T12:05:00Z',
          ends_at: '2026-10-15T13:00:00Z',
          work_minutes: 55,
          status: 'planned',
          source: 'planner',
          pinned: false,
          actual_minutes: null,
          closed_at: null,
        },
        // 4. Future unpinned block of a HARD task -> kept in busy, NOT removed
        {
          id: 'block-hard',
          task_id: 'task-hard',
          starts_at: '2026-10-15T16:00:00Z',
          ends_at: '2026-10-15T17:00:00Z',
          work_minutes: 60,
          status: 'planned',
          source: 'manual',
          pinned: false,
          actual_minutes: null,
          closed_at: null,
        },
      ],
    });

    // Act
    const result = buildPlannerInput(data, now);

    // Assert
    expect(result.removeBlockIds).toEqual([]);
    expect(result.input.busy).toHaveLength(4);
  });

  it('should fall back to daily metrics when reflection level is basic', () => {
    // Arrange: reflection level is 'basic'. Daily metrics have 6 closed blocks (2 done, 4 missed) -> completion 33% < 50%.
    const now = new Date('2026-10-15T12:00:00Z');
    const data = createBasePlannerData({
      profile: {
        id: 'user-1',
        timezone: 'Europe/Warsaw',
        day_start: '08:00:00',
        day_end: '20:00:00',
        daily_energy_limit: 20,
        reflection_level: 'basic',
      },
      latestReflection: {
        week_start: '2026-10-12',
        fatigue: 5,
        stress: 5,
        focus: 1,
        distractions: 5,
      },
      blocks: [
        {
          id: 'b-1',
          task_id: null,
          starts_at: '2026-10-14T08:00:00Z',
          ends_at: '2026-10-14T09:00:00Z',
          work_minutes: 60,
          status: 'done',
          source: 'manual',
          pinned: false,
          actual_minutes: 60,
          closed_at: '2026-10-14T09:00:00Z',
        },
        {
          id: 'b-2',
          task_id: null,
          starts_at: '2026-10-14T09:00:00Z',
          ends_at: '2026-10-14T10:00:00Z',
          work_minutes: 60,
          status: 'done',
          source: 'manual',
          pinned: false,
          actual_minutes: 60,
          closed_at: '2026-10-14T10:00:00Z',
        },
        {
          id: 'b-3',
          task_id: null,
          starts_at: '2026-10-13T08:00:00Z',
          ends_at: '2026-10-13T09:00:00Z',
          work_minutes: 60,
          status: 'missed',
          source: 'manual',
          pinned: false,
          actual_minutes: null,
          closed_at: '2026-10-13T09:00:00Z',
        },
        {
          id: 'b-4',
          task_id: null,
          starts_at: '2026-10-13T09:00:00Z',
          ends_at: '2026-10-13T10:00:00Z',
          work_minutes: 60,
          status: 'missed',
          source: 'manual',
          pinned: false,
          actual_minutes: null,
          closed_at: '2026-10-13T10:00:00Z',
        },
        {
          id: 'b-5',
          task_id: null,
          starts_at: '2026-10-12T08:00:00Z',
          ends_at: '2026-10-12T09:00:00Z',
          work_minutes: 60,
          status: 'missed',
          source: 'manual',
          pinned: false,
          actual_minutes: null,
          closed_at: '2026-10-12T09:00:00Z',
        },
        {
          id: 'b-6',
          task_id: null,
          starts_at: '2026-10-12T09:00:00Z',
          ends_at: '2026-10-12T10:00:00Z',
          work_minutes: 60,
          status: 'missed',
          source: 'manual',
          pinned: false,
          actual_minutes: null,
          closed_at: '2026-10-12T10:00:00Z',
        },
      ],
    });

    // Act
    const result = buildPlannerInput(data, now);

    // Assert: Daily fallback overload applies: 20 * 0.85 = 17, stressMode is true
    expect(result.input.energyLimit).toBe(17);
    expect(result.input.stressMode).toBe(true);
  });

  it('should fall back to daily metrics when reflection is older than 14 days', () => {
    // Arrange: reflection week_start is 2026-10-01 (19 days ago, older than 14 days).
    const now = new Date('2026-10-20T12:00:00Z');
    const data = createBasePlannerData({
      profile: {
        id: 'user-1',
        timezone: 'Europe/Warsaw',
        day_start: '08:00:00',
        day_end: '20:00:00',
        daily_energy_limit: 20,
        reflection_level: 'analytic',
      },
      latestReflection: {
        week_start: '2026-10-01',
        fatigue: 5,
        stress: 5,
        focus: 1,
        distractions: 5,
      },
      // 5 done blocks with good pace -> daily metrics report no overload
      blocks: [
        {
          id: 'b-1',
          task_id: null,
          starts_at: '2026-10-19T08:00:00Z',
          ends_at: '2026-10-19T09:00:00Z',
          work_minutes: 60,
          status: 'done',
          source: 'manual',
          pinned: false,
          actual_minutes: 60,
          closed_at: '2026-10-19T09:00:00Z',
        },
        {
          id: 'b-2',
          task_id: null,
          starts_at: '2026-10-18T08:00:00Z',
          ends_at: '2026-10-18T09:00:00Z',
          work_minutes: 60,
          status: 'done',
          source: 'manual',
          pinned: false,
          actual_minutes: 60,
          closed_at: '2026-10-18T09:00:00Z',
        },
        {
          id: 'b-3',
          task_id: null,
          starts_at: '2026-10-17T08:00:00Z',
          ends_at: '2026-10-17T09:00:00Z',
          work_minutes: 60,
          status: 'done',
          source: 'manual',
          pinned: false,
          actual_minutes: 60,
          closed_at: '2026-10-17T09:00:00Z',
        },
        {
          id: 'b-4',
          task_id: null,
          starts_at: '2026-10-16T08:00:00Z',
          ends_at: '2026-10-16T09:00:00Z',
          work_minutes: 60,
          status: 'done',
          source: 'manual',
          pinned: false,
          actual_minutes: 60,
          closed_at: '2026-10-16T09:00:00Z',
        },
        {
          id: 'b-5',
          task_id: null,
          starts_at: '2026-10-15T08:00:00Z',
          ends_at: '2026-10-15T09:00:00Z',
          work_minutes: 60,
          status: 'done',
          source: 'manual',
          pinned: false,
          actual_minutes: 60,
          closed_at: '2026-10-15T09:00:00Z',
        },
      ],
    });

    // Act
    const result = buildPlannerInput(data, now);

    // Assert: Reflection ignored because it's > 14 days old. Daily metrics healthy -> limit is full 20, stressMode false.
    expect(result.input.energyLimit).toBe(20);
    expect(result.input.stressMode).toBe(false);
  });

  it('should apply weekly reflection scores when reflection is fresh and level is analytic', () => {
    // Arrange: reflection week_start is 2026-10-12 (3 days ago, fresh). Overload is 5.0 -> multiplier is 0.60.
    const now = new Date('2026-10-15T12:00:00Z');
    const data = createBasePlannerData({
      profile: {
        id: 'user-1',
        timezone: 'Europe/Warsaw',
        day_start: '08:00:00',
        day_end: '20:00:00',
        daily_energy_limit: 20,
        reflection_level: 'analytic',
      },
      latestReflection: {
        week_start: '2026-10-12',
        fatigue: 5,
        stress: 5,
        focus: 1,
        distractions: 5,
      },
    });

    // Act
    const result = buildPlannerInput(data, now);

    // Assert: Overload 5.0 -> multiplier 0.60 -> limit round(20 * 0.60) = 12
    expect(result.input.energyLimit).toBe(12);
    expect(result.input.stressMode).toBe(true);
  });

  it('should correctly calculate workToPlan taking into account done and kept busy blocks', () => {
    // Arrange: Task estimate = 180 min.
    // Done block = 60 min.
    // Kept planned pinned block in future = 45 min.
    // Unpinned planned block in future = 50 min (removable, NOT kept!).
    // Past ended unclosed block = 30 min (unclosed past block is missed, NOT kept!).
    // Expected workToPlan: 180 - 60 - 45 = 75 min.
    const now = new Date('2026-10-15T12:00:00Z');
    const data = createBasePlannerData({
      tasks: [
        {
          id: 'task-work',
          type_id: 'type-study',
          notes: null,
          priority: 1,
          fixation: 'flexible',
          estimate_minutes: 180,
          session_minutes: 90,
          deadline: null,
          created_at: '2026-10-10T10:00:00Z',
          status: 'active',
        },
      ],
      blocks: [
        // Done block: 60 min
        {
          id: 'b-done',
          task_id: 'task-work',
          starts_at: '2026-10-14T10:00:00Z',
          ends_at: '2026-10-14T11:00:00Z',
          work_minutes: 60,
          status: 'done',
          source: 'manual',
          pinned: false,
          actual_minutes: 60,
          closed_at: '2026-10-14T11:00:00Z',
        },
        // Kept block: pinned, ends in future -> 45 min
        {
          id: 'b-kept',
          task_id: 'task-work',
          starts_at: '2026-10-15T14:00:00Z',
          ends_at: '2026-10-15T14:45:00Z',
          work_minutes: 45,
          status: 'planned',
          source: 'manual',
          pinned: true,
          actual_minutes: null,
          closed_at: null,
        },
        // Removable future block: unpinned -> 50 min
        {
          id: 'b-removable',
          task_id: 'task-work',
          starts_at: '2026-10-15T16:00:00Z',
          ends_at: '2026-10-15T16:50:00Z',
          work_minutes: 50,
          status: 'planned',
          source: 'planner',
          pinned: false,
          actual_minutes: null,
          closed_at: null,
        },
        // Past ended unclosed block: ended before now -> 30 min (must NOT be kept)
        {
          id: 'b-past-missed',
          task_id: 'task-work',
          starts_at: '2026-10-15T09:00:00Z',
          ends_at: '2026-10-15T09:30:00Z',
          work_minutes: 30,
          status: 'planned',
          source: 'planner',
          pinned: false,
          actual_minutes: null,
          closed_at: null,
        },
      ],
    });

    // Act
    const result = buildPlannerInput(data, now);

    // Assert
    expect(result.input.tasks).toHaveLength(1);
    expect(result.input.tasks[0]?.workToPlan).toBe(75);
    expect(result.removeBlockIds).toEqual(['b-removable']);
  });

  it('should skip tasks without estimate_minutes', () => {
    // Arrange: task without estimate is an idea, not planable work.
    const now = new Date('2026-10-15T12:00:00Z');
    const data = createBasePlannerData({
      tasks: [
        {
          id: 'task-idea',
          type_id: 'type-study',
          notes: 'Kiedyś to zrobię',
          priority: 3,
          fixation: 'flexible',
          estimate_minutes: null,
          session_minutes: null,
          deadline: null,
          created_at: '2026-10-10T10:00:00Z',
          status: 'active',
        },
        {
          id: 'task-real',
          type_id: 'type-study',
          notes: 'Zadanie z fizyki',
          priority: 2,
          fixation: 'flexible',
          estimate_minutes: 90,
          session_minutes: 45,
          deadline: null,
          created_at: '2026-10-10T10:00:00Z',
          status: 'active',
        },
      ],
    });

    // Act
    const result = buildPlannerInput(data, now);

    // Assert
    expect(result.input.tasks).toHaveLength(1);
    expect(result.input.tasks[0]?.id).toBe('task-real');
    expect(result.input.tasks[0]?.workToPlan).toBe(90);
  });

  it('should omit flexible tasks whose workToPlan is 0', () => {
    // Arrange: estimate is 60, but already completed 60 min.
    const now = new Date('2026-10-15T12:00:00Z');
    const data = createBasePlannerData({
      tasks: [
        {
          id: 'task-done-already',
          type_id: 'type-study',
          notes: null,
          priority: 2,
          fixation: 'flexible',
          estimate_minutes: 60,
          session_minutes: 60,
          deadline: null,
          created_at: '2026-10-10T10:00:00Z',
          status: 'active',
        },
      ],
      blocks: [
        {
          id: 'block-completed',
          task_id: 'task-done-already',
          starts_at: '2026-10-14T10:00:00Z',
          ends_at: '2026-10-14T11:00:00Z',
          work_minutes: 60,
          status: 'done',
          source: 'manual',
          pinned: false,
          actual_minutes: 60,
          closed_at: '2026-10-14T11:00:00Z',
        },
      ],
    });

    // Act
    const result = buildPlannerInput(data, now);

    // Assert: task needs 0 minutes, so it is omitted from input.tasks
    expect(result.input.tasks).toHaveLength(0);
  });

  it('should convert postgres time format to local HH:mm', () => {
    // Arrange: day_start '07:30:00', day_end '21:45:00'
    const now = new Date('2026-10-15T12:00:00Z');
    const data = createBasePlannerData({
      profile: {
        id: 'user-1',
        timezone: 'Europe/Warsaw',
        day_start: '07:30:00',
        day_end: '21:45:00',
        daily_energy_limit: 20,
        reflection_level: 'analytic',
      },
    });

    // Act
    const result = buildPlannerInput(data, now);

    // Assert
    expect(result.input.dayStart).toBe('07:30');
    expect(result.input.dayEnd).toBe('21:45');
  });
});
