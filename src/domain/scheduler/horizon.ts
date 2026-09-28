import {
  BREAK_AFTER_HEAVY,
  HORIZON_DAYS,
  MAX_CONTINUOUS_HEAVY,
  MAX_HORIZON_DAYS,
  MINUTES_PER_HOUR,
  MS_PER_DAY,
  START_BUFFER,
} from '@/domain/constants';
import { clampInterval, overlaps, startsWithin } from '@/domain/intervals';
import { ceilTo } from '@/domain/math';
import {
  addDaysToLocalDate,
  instantToLocalDate,
  localDayRange,
  minutesToMs,
  zonedToInstant,
} from '@/domain/time';
import {
  SLOT_MS,
  energyMinutes,
  isHeavy,
  type PlanContext,
  type PlanDay,
} from '@/domain/scheduler/model';
import type {
  BusyItem,
  Instant,
  Interval,
  LocalDate,
  PlannerInput,
  PlannerTask,
} from '@/domain/types';

/**
 * Step 1: the horizon [from, to). `from` is now + START_BUFFER rounded up to the grid; `to` is
 * HORIZON_DAYS later or the farthest deadline of a task with work, whichever is later,
 * but never more than MAX_HORIZON_DAYS after `from`.
 */
export function planningHorizon(now: Instant, tasks: readonly PlannerTask[]): Interval {
  const from = ceilTo(now + minutesToMs(START_BUFFER), SLOT_MS);
  let to = from + HORIZON_DAYS * MS_PER_DAY;
  for (const task of tasks) {
    if (task.workToPlan > 0 && task.deadline !== null) {
      to = Math.max(to, task.deadline);
    }
  }
  return { start: from, end: Math.min(to, from + MAX_HORIZON_DAYS * MS_PER_DAY) };
}

/**
 * Steps 2–3: the working window of every local date of the horizon, the busy intervals inside it,
 * the load they already cost, and the demanding busy work that chains can reach.
 */
export function buildPlanContext(input: PlannerInput, horizon: Interval): PlanContext {
  return {
    days: buildDays(input, horizon),
    dayCapacity: input.energyLimit * MINUTES_PER_HOUR,
    heavyBusy: heavyBusyNear(input.busy, horizon),
  };
}

function buildDays(input: PlannerInput, horizon: Interval): PlanDay[] {
  const days: PlanDay[] = [];
  const firstDate = instantToLocalDate(horizon.start, input.timezone);
  const lastDate = instantToLocalDate(horizon.end - 1, input.timezone); // `end` itself is excluded
  for (let date = firstDate; date <= lastDate; date = addDaysToLocalDate(date, 1)) {
    const workingHours = {
      start: zonedToInstant(date, input.dayStart, input.timezone),
      end: zonedToInstant(date, input.dayEnd, input.timezone),
    };
    const window = clampInterval(workingHours, horizon);
    if (window !== null) {
      days.push({ date, window, ...busyOfDay(input, date, window) });
    }
  }
  return days;
}

function busyOfDay(
  input: PlannerInput,
  date: LocalDate,
  window: Interval,
): Pick<PlanDay, 'busy' | 'busyLoad' | 'busyTaskIds'> {
  const wholeDay = localDayRange(date, input.timezone);
  const busy: Interval[] = [];
  const busyTaskIds: string[] = [];
  let busyLoad = 0;
  for (const item of input.busy) {
    if (overlaps(item.interval, window)) {
      busy.push(item.interval);
    }
    // Load counts the whole calendar day: a 06:00 training tires even when work starts at 08:00.
    const partOfDay = clampInterval(item.interval, wholeDay);
    if (partOfDay !== null) {
      busyLoad += energyMinutes(partOfDay, item.energy);
    }
    // A block belongs to the date it starts on, as in the calendar, so it is counted once.
    const taskId = item.taskId ?? null;
    if (taskId !== null && startsWithin(item.interval, wholeDay)) {
      busyTaskIds.push(taskId);
    }
  }
  return { busy, busyLoad, busyTaskIds };
}

/**
 * Demanding busy intervals that can share a chain with a new block. An item further than
 * MAX_CONTINUOUS_HEAVY + BREAK_AFTER_HEAVY from the horizon cannot change a decision: any chain
 * reaching it is longer than the limit even without it.
 */
function heavyBusyNear(busy: readonly BusyItem[], horizon: Interval): Interval[] {
  const reach = minutesToMs(MAX_CONTINUOUS_HEAVY + BREAK_AFTER_HEAVY);
  const near = { start: horizon.start - reach, end: horizon.end + reach };
  return busy
    .filter((item) => isHeavy(item.energy) && overlaps(item.interval, near))
    .map((item) => item.interval);
}
