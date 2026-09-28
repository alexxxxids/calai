import { RECOVERY_MINUTES } from '@/domain/constants';
import { subtractIntervals } from '@/domain/intervals';
import { floorTo } from '@/domain/math';
import { SLOT_MS, type DraftBlock, type PlanDay } from '@/domain/scheduler/model';
import { minutesToMs } from '@/domain/time';
import type { Interval } from '@/domain/types';

/**
 * §5.3, step 4 (stress mode): one RECOVERY_MINUTES block per day, in the latest free hour of the
 * working window, so that rest comes in the evening and not in the middle of morning study.
 * A day without a free hour gets none: fixed events matter more than scheduled rest.
 */
export function recoveryBlocks(days: readonly PlanDay[]): DraftBlock[] {
  const blocks: DraftBlock[] = [];
  for (const [dayIndex, day] of days.entries()) {
    const interval = latestFreeHour(day);
    if (interval !== null) {
      blocks.push({ owner: null, dayIndex, interval, workMinutes: RECOVERY_MINUTES });
    }
  }
  return blocks;
}

function latestFreeHour(day: PlanDay): Interval | null {
  const recoveryMs = minutesToMs(RECOVERY_MINUTES);
  // Free windows from the last one backwards; in each, the block ends as late as the grid allows.
  for (const free of subtractIntervals(day.window, day.busy).toReversed()) {
    const end = floorTo(free.end, SLOT_MS);
    if (end - recoveryMs >= free.start) {
      return { start: end - recoveryMs, end };
    }
  }
  return null;
}
