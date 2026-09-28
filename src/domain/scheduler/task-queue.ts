import { evictLessImportant } from '@/domain/scheduler/evict';
import type { PlanContext, PlanState, TaskProgress } from '@/domain/scheduler/model';
import { placeRemainingWork } from '@/domain/scheduler/place-task';
import type { Instant, PlannerTask } from '@/domain/types';

type TaskComparator = (a: PlannerTask, b: PlannerTask) => number;

/** §6.3 step 5: the queue order, compared key by key until one differs. */
const QUEUE_ORDER: readonly TaskComparator[] = [
  (a, b) => compareDeadlines(a.deadline, b.deadline), // Earliest Deadline First, no deadline last
  (a, b) => a.priority - b.priority, // then the more important task (1 first)
  (a, b) => a.createdAt - b.createdAt, // then the older task
  (a, b) => compareIds(a.id, b.id), // finally the id: the same tasks always give the same plan
];

/**
 * Queue order for sort(): earliest deadline first (tasks without a deadline last), then priority,
 * then creation time, then id. EDF meets the most deadlines; the last two keys make the order,
 * and so the whole plan, independent of the order in which tasks arrive.
 */
export function compareTasks(a: PlannerTask, b: PlannerTask): number {
  for (const compareKey of QUEUE_ORDER) {
    const order = compareKey(a, b);
    if (order !== 0) {
      return order;
    }
  }
  return 0;
}

/**
 * One progress card per task that has work to place, sorted in queue order, all waiting in the queue.
 */
export function createQueue(tasks: readonly PlannerTask[]): TaskProgress[] {
  return tasks
    .filter((task) => task.workToPlan > 0)
    .sort(compareTasks)
    .map((task) => ({ task, remaining: task.workToPlan, isQueued: true, hasEvicted: false }));
}

/**
 * Steps 5–6 and §6.5: repeatedly takes the first waiting task in queue order and places its work.
 * Evicted tasks wait again and get another turn. It ends because only a strictly more important
 * task can evict, and every task evicts at most once.
 */
export function runQueue(state: PlanState, plan: PlanContext): void {
  let next = state.queue.find((entry) => entry.isQueued);
  while (next !== undefined) {
    next.isQueued = false;
    placeWithEviction(next, state, plan);
    next = state.queue.find((entry) => entry.isQueued);
  }
}

/** Places the task; if work is left, evicts less important blocks once and places the rest again. */
function placeWithEviction(entry: TaskProgress, state: PlanState, plan: PlanContext): void {
  placeRemainingWork(entry, plan, state);
  if (entry.remaining === 0 || entry.hasEvicted) {
    return;
  }
  entry.hasEvicted = true;
  if (evictLessImportant(entry.task, state) > 0) {
    placeRemainingWork(entry, plan, state);
  }
}

function compareDeadlines(a: Instant | null, b: Instant | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1; // no deadline goes after any deadline
  }
  if (b === null) {
    return -1;
  }
  return a - b;
}

function compareIds(a: string, b: string): number {
  // Plain < instead of localeCompare: the order must not depend on the machine's language settings.
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
