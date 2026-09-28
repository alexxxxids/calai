import { describe, expect, it } from 'vitest';

import { compareTasks, createQueue } from '@/domain/scheduler/task-queue';
import type { PlannerTask } from '@/domain/types';

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

function queueOrder(tasks: PlannerTask[]): string[] {
  return [...tasks].sort(compareTasks).map((entry) => entry.id);
}

describe('compareTasks', () => {
  it('should put the earlier deadline first', () => {
    const tasks = [task({ id: 'later', deadline: 2_000 }), task({ id: 'sooner', deadline: 1_000 })];

    expect(queueOrder(tasks)).toEqual(['sooner', 'later']);
  });

  it('should put a task without a deadline after every task with one', () => {
    const tasks = [
      task({ id: 'someday', deadline: null }),
      task({ id: 'dated', deadline: 9_000, priority: 3 }),
    ];

    expect(queueOrder(tasks)).toEqual(['dated', 'someday']);
  });

  it('should put the more important task first when deadlines are equal', () => {
    const tasks = [
      task({ id: 'minor', priority: 3, createdAt: 1 }),
      task({ id: 'major', priority: 1, createdAt: 2 }),
    ];

    expect(queueOrder(tasks)).toEqual(['major', 'minor']);
  });

  it('should put the older task first when deadline and priority are equal', () => {
    const tasks = [task({ id: 'new', createdAt: 2 }), task({ id: 'old', createdAt: 1 })];

    expect(queueOrder(tasks)).toEqual(['old', 'new']);
  });

  it('should order by id when everything else is equal', () => {
    const tasks = [task({ id: 'b' }), task({ id: 'a' }), task({ id: 'c' })];

    expect(queueOrder(tasks)).toEqual(['a', 'b', 'c']);
  });

  it('should compare ids by their characters, not by the language settings of the machine', () => {
    // Plain comparison puts upper-case letters before lower-case ones; localeCompare would not.
    const tasks = [task({ id: 'a' }), task({ id: 'B' })];

    expect(queueOrder(tasks)).toEqual(['B', 'a']);
  });
});

describe('createQueue', () => {
  it('should skip tasks without work and sort the rest in queue order', () => {
    const tasks = [
      task({ id: 'nothing-left', workToPlan: 0, deadline: 1_000 }),
      task({ id: 'later', deadline: 3_000 }),
      task({ id: 'sooner', deadline: 2_000 }),
    ];

    const queue = createQueue(tasks);

    expect(queue.map((entry) => entry.task.id)).toEqual(['sooner', 'later']);
  });

  it('should start every card with all of its work remaining and waiting in the queue', () => {
    const queue = createQueue([task({ id: 'a', workToPlan: 90 })]);

    expect(queue).toEqual([
      { task: task({ id: 'a', workToPlan: 90 }), remaining: 90, isQueued: true, hasEvicted: false },
    ]);
  });
});
