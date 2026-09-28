import type { DraftBlock, PlanState } from '@/domain/scheduler/model';
import type { Interval, PlannerTask } from '@/domain/types';

/**
 * §6.5 steps 1–2: removes this run's blocks of less important tasks that start before the deadline
 * of `evictor` (all of them if it has no deadline), gives their work back to their tasks and puts
 * those tasks back into the queue. Returns how many blocks were removed.
 */
export function evictLessImportant(evictor: PlannerTask, state: PlanState): number {
  const kept: DraftBlock[] = [];
  for (const block of state.blocks) {
    if (block.owner !== null && canEvict(evictor, block.owner.task, block.interval)) {
      block.owner.remaining += block.workMinutes;
      block.owner.isQueued = true;
    } else {
      kept.push(block);
    }
  }
  const evictedCount = state.blocks.length - kept.length;
  state.blocks = kept;
  return evictedCount;
}

function canEvict(evictor: PlannerTask, owner: PlannerTask, interval: Interval): boolean {
  const isLessImportant = owner.priority > evictor.priority; // priority 1 is the most important
  const startsBeforeDeadline = evictor.deadline === null || interval.start < evictor.deadline;
  return isLessImportant && startsBeforeDeadline;
}
