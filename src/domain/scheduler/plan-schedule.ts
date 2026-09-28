import { buildPlanContext, planningHorizon } from '@/domain/scheduler/horizon';
import type { DraftBlock, PlanState, TaskProgress } from '@/domain/scheduler/model';
import { recoveryBlocks } from '@/domain/scheduler/recovery';
import { createQueue, runQueue } from '@/domain/scheduler/task-queue';
import type {
  Interval,
  PlannedBlock,
  PlannerInput,
  PlannerResult,
  UnscheduledWork,
} from '@/domain/types';

/**
 * Plans the flexible work of all tasks into free time (docs/algorithms.md §6). Pure: the same input
 * always gives the same plan. New blocks never overlap each other or `busy`, stay inside working
 * hours on the 15-minute grid, end by their deadlines and keep every day within the energy limit.
 * Work that does not fit is reported in `unscheduled`, never squeezed into less time.
 */
export function planSchedule(input: PlannerInput): PlannerResult {
  const horizon = planningHorizon(input.now, input.tasks);
  const plan = buildPlanContext(input, horizon);
  const state: PlanState = { blocks: [], queue: createQueue(input.tasks) };
  if (input.stressMode) {
    state.blocks.push(...recoveryBlocks(plan.days));
  }
  runQueue(state, plan);
  // Blocks never overlap, so sorting by start alone gives one fixed order.
  const blocks = [...state.blocks].sort((a, b) => a.interval.start - b.interval.start);
  const leftovers = state.queue.filter((entry) => entry.remaining > 0);
  return {
    blocks: blocks.map(toPlannedBlock),
    unscheduled: leftovers.map((entry) => toUnscheduled(entry, horizon)),
  };
}

function toPlannedBlock(block: DraftBlock): PlannedBlock {
  return {
    taskId: block.owner === null ? null : block.owner.task.id,
    interval: block.interval,
    workMinutes: block.workMinutes,
    source: block.owner === null ? 'rest' : 'planner',
  };
}

function toUnscheduled(entry: TaskProgress, horizon: Interval): UnscheduledWork {
  const { deadline } = entry.task;
  // A deadline inside the horizon is what we cannot meet; otherwise the horizon itself is full.
  const isDeadlineMissed = deadline !== null && deadline <= horizon.end;
  return {
    taskId: entry.task.id,
    missingMinutes: entry.remaining,
    reason: isDeadlineMissed ? 'deadline' : 'capacity',
  };
}
