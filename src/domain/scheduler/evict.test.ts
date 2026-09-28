import { describe, expect, it } from 'vitest';

import { evictLessImportant } from '@/domain/scheduler/evict';
import type { DraftBlock, PlanState, TaskProgress } from '@/domain/scheduler/model';
import type { Interval, PlannerTask } from '@/domain/types';

function span(start: string, end: string): Interval {
  return { start: Date.parse(`2026-10-05T${start}:00Z`), end: Date.parse(`2026-10-05T${end}:00Z`) };
}

function card(fields: Partial<PlannerTask> & Pick<PlannerTask, 'id'>): TaskProgress {
  const task: PlannerTask = {
    priority: 2,
    deadline: null,
    createdAt: 0,
    energy: 1,
    workToPlan: 120,
    pace: 1,
    sessionMinutes: null,
    ...fields,
  };
  return { task, remaining: 0, isQueued: false, hasEvicted: false };
}

function block(owner: TaskProgress | null, interval: Interval, workMinutes: number): DraftBlock {
  return { owner, dayIndex: 0, interval, workMinutes };
}

describe('evictLessImportant', () => {
  it('should remove less important blocks before the deadline and give their work back', () => {
    // Arrange
    const evictor = card({
      id: 'urgent',
      priority: 1,
      deadline: Date.parse('2026-10-05T12:00:00Z'),
    });
    const minor = card({ id: 'minor', priority: 3 });
    const peer = card({ id: 'peer', priority: 1 });
    const minorEarly = block(minor, span('08:00', '09:00'), 60);
    const minorLate = block(minor, span('13:00', '14:00'), 60);
    const peerBlock = block(peer, span('09:00', '10:00'), 60);
    const recovery = block(null, span('10:00', '11:00'), 60);
    const state: PlanState = {
      blocks: [minorEarly, peerBlock, recovery, minorLate],
      queue: [evictor, minor, peer],
    };

    // Act
    const evicted = evictLessImportant(evictor.task, state);

    // Assert: only the minor block before 12:00 goes; equal priority and recovery stay.
    expect(evicted).toBe(1);
    expect(state.blocks).toEqual([peerBlock, recovery, minorLate]);
    expect(minor).toMatchObject({ remaining: 60, isQueued: true });
    expect(peer).toMatchObject({ remaining: 0, isQueued: false });
  });

  it('should remove every less important block when the evictor has no deadline', () => {
    const evictor = card({ id: 'important', priority: 1 });
    const minor = card({ id: 'minor', priority: 2 });
    const state: PlanState = {
      blocks: [block(minor, span('08:00', '09:00'), 45), block(minor, span('20:00', '21:00'), 50)],
      queue: [evictor, minor],
    };

    const evicted = evictLessImportant(evictor.task, state);

    expect(evicted).toBe(2);
    expect(state.blocks).toEqual([]);
    expect(minor.remaining).toBe(95);
  });

  it('should remove nothing when no task is less important', () => {
    const evictor = card({ id: 'minor', priority: 3 });
    const other = card({ id: 'other', priority: 1 });
    const state: PlanState = {
      blocks: [block(other, span('08:00', '09:00'), 60)],
      queue: [evictor, other],
    };

    expect(evictLessImportant(evictor.task, state)).toBe(0);
    expect(state.blocks).toHaveLength(1);
  });
});
