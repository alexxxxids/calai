import { MAX_CONTINUOUS_HEAVY, MAX_SESSIONS_PER_TASK_PER_DAY } from '@/domain/constants';
import { subtractIntervals } from '@/domain/intervals';
import { ceilTo } from '@/domain/math';
import { buildHeavyChains, chainMinutesWith, isChainNear } from '@/domain/scheduler/heavy-chains';
import {
  SLOT_MS,
  blockEnergy,
  energyMinutes,
  isHeavy,
  type DraftBlock,
  type PlanContext,
  type PlanDay,
} from '@/domain/scheduler/model';
import { minutesToMs } from '@/domain/time';
import type { Instant, Interval, PlannerTask } from '@/domain/types';

/** A block the planner wants to place: whose it is and how long it is. */
export interface BlockRequest {
  readonly task: PlannerTask;
  readonly durationMinutes: number;
}

/** Where a block fits: the index of its day and its time. */
export interface Slot {
  readonly dayIndex: number;
  readonly interval: Interval;
}

/**
 * §6.3 step 6: the earliest start on the SLOT grid where the block (1) lies in free working time,
 * (2) ends by the deadline, (3) keeps the day within the energy limit, (4) keeps chains of demanding
 * work within MAX_CONTINUOUS_HEAVY and (5) is at most the task's 2nd block that day. null if none.
 */
export function findEarliestSlot(
  request: BlockRequest,
  plan: PlanContext,
  blocks: readonly DraftBlock[],
): Slot | null {
  // Chains matter only for demanding work; light work may sit next to anything.
  const chains = isHeavy(request.task.energy)
    ? buildHeavyChains([...plan.heavyBusy, ...heavyBlockIntervals(blocks)])
    : [];
  for (const [dayIndex, day] of plan.days.entries()) {
    // Check 2 for the whole day: if even its first moment is too late, every later day is too.
    if (endsAfterDeadline(day.window.start + minutesToMs(request.durationMinutes), request.task)) {
      return null;
    }
    const dayBlocks = blocks.filter((block) => block.dayIndex === dayIndex);
    const isDayFull =
      !hasSessionLeft(day, dayBlocks, request.task) ||
      !hasEnergyLeft(day, dayBlocks, request, plan);
    if (isDayFull) {
      continue; // checks 5 and 3 do not depend on the start time
    }
    const nearChains = chains.filter((chain) => isChainNear(chain, day.window));
    const interval = earliestStartInDay({ day, dayBlocks, nearChains, request });
    if (interval !== null) {
      return { dayIndex, interval };
    }
  }
  return null;
}

interface DaySearch {
  readonly day: PlanDay;
  readonly dayBlocks: readonly DraftBlock[];
  /** Chains of demanding work close to this day; empty for light work. */
  readonly nearChains: readonly Interval[];
  readonly request: BlockRequest;
}

function earliestStartInDay(search: DaySearch): Interval | null {
  const { day, dayBlocks, nearChains, request } = search;
  const durationMs = minutesToMs(request.durationMinutes);
  const occupied = [...day.busy, ...dayBlocks.map((block) => block.interval)];
  for (const free of subtractIntervals(day.window, occupied)) {
    // Check 1: starts on the grid from which the whole block still fits into this free window.
    const lastStart = free.end - durationMs;
    for (let start = ceilTo(free.start, SLOT_MS); start <= lastStart; start += SLOT_MS) {
      const candidate = { start, end: start + durationMs };
      if (endsAfterDeadline(candidate.end, request.task)) {
        return null; // later starts end even later
      }
      if (keepsBreakRule(candidate, request.task, nearChains)) {
        return candidate;
      }
    }
  }
  return null;
}

/** Check 2: a block must end by its task's deadline. */
function endsAfterDeadline(end: Instant, task: PlannerTask): boolean {
  return task.deadline !== null && end > task.deadline;
}

/** Check 3: the block may not push the day over its energy limit. */
function hasEnergyLeft(
  day: PlanDay,
  dayBlocks: readonly DraftBlock[],
  request: BlockRequest,
  plan: PlanContext,
): boolean {
  const blockLoad = request.durationMinutes * request.task.energy;
  if (blockLoad === 0) {
    return true; // work that costs no energy cannot make a day heavier, even a day already over the limit
  }
  let dayLoad = day.busyLoad;
  for (const block of dayBlocks) {
    dayLoad += energyMinutes(block.interval, blockEnergy(block));
  }
  return dayLoad + blockLoad <= plan.dayCapacity;
}

/** Check 4: demanding work must not make a chain longer than MAX_CONTINUOUS_HEAVY. */
function keepsBreakRule(
  candidate: Interval,
  task: PlannerTask,
  nearChains: readonly Interval[],
): boolean {
  return !isHeavy(task.energy) || chainMinutesWith(candidate, nearChains) <= MAX_CONTINUOUS_HEAVY;
}

/** Check 5: at most MAX_SESSIONS_PER_TASK_PER_DAY blocks of one task per day, fixed ones included. */
function hasSessionLeft(
  day: PlanDay,
  dayBlocks: readonly DraftBlock[],
  task: PlannerTask,
): boolean {
  const fixed = day.busyTaskIds.filter((taskId) => taskId === task.id).length;
  const planned = dayBlocks.filter((block) => block.owner?.task.id === task.id).length;
  return fixed + planned < MAX_SESSIONS_PER_TASK_PER_DAY;
}

function heavyBlockIntervals(blocks: readonly DraftBlock[]): Interval[] {
  return blocks.filter((block) => isHeavy(blockEnergy(block))).map((block) => block.interval);
}
