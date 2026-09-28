import { HEAVY_ENERGY, RECOVERY_ENERGY, SLOT } from '@/domain/constants';
import { durationMinutes } from '@/domain/intervals';
import { minutesToMs } from '@/domain/time';
import type { Interval, LocalDate, PlannerTask } from '@/domain/types';

// Internal data of one planner run. Nothing here is exported from the scheduler.

/** The grid step in milliseconds, the unit of instants. */
export const SLOT_MS = minutesToMs(SLOT);

/** One local date of the horizon with everything that stays fixed while tasks are placed. */
export interface PlanDay {
  readonly date: LocalDate;
  /** Working hours of this date (dayStart–dayEnd in the user's zone), cut to the horizon. */
  readonly window: Interval;
  /** Busy intervals that overlap the window: blocks must avoid them. */
  readonly busy: readonly Interval[];
  /** Energy-minutes the busy items of this calendar day already cost (lessons tire too). */
  readonly busyLoad: number;
  /** Task ids of fixed blocks that start on this date, once per block: they use up sessions. */
  readonly busyTaskIds: readonly string[];
}

/** Facts about the whole run that do not change while tasks are placed. */
export interface PlanContext {
  readonly days: readonly PlanDay[];
  /** The daily energy limit in energy-minutes (points × 60). */
  readonly dayCapacity: number;
  /** Busy intervals of demanding work near the horizon, for chains (§6.3 check 4). */
  readonly heavyBusy: readonly Interval[];
}

/** The planner's card for one task: how much work still waits and its place in the queue. */
export interface TaskProgress {
  readonly task: PlannerTask;
  /** Minutes of work that have no block yet. */
  remaining: number;
  /** Waits for its (next) turn in the queue. */
  isQueued: boolean;
  /** Has already used its single eviction (§6.5). */
  hasEvicted: boolean;
}

/** A block placed during this run. */
export interface DraftBlock {
  /** The task the block belongs to; null for a recovery block. */
  readonly owner: TaskProgress | null;
  /** Index of its day in PlanContext.days. */
  readonly dayIndex: number;
  readonly interval: Interval;
  readonly workMinutes: number;
}

/** Everything that changes while tasks are placed. */
export interface PlanState {
  /** Every block placed so far: recovery blocks and task blocks. */
  blocks: DraftBlock[];
  /** One card per task with work to place, in queue order. */
  readonly queue: readonly TaskProgress[];
}

/** Demanding work (energy ≥ HEAVY_ENERGY) needs breaks. */
export function isHeavy(energy: number): boolean {
  return energy >= HEAVY_ENERGY;
}

/** Energy of a placed block: its task's energy, or 0 for recovery. */
export function blockEnergy(block: DraftBlock): number {
  return block.owner?.task.energy ?? RECOVERY_ENERGY;
}

/**
 * Load in energy-minutes = minutes × energy (60 energy-minutes = 1 point).
 * Points are fractions (50 minutes = 0.8333… hours), and sums of fractions pick up floating-point
 * errors; minutes × energy are whole numbers, so the "≤ limit" check stays exact.
 */
export function energyMinutes(interval: Interval, energy: number): number {
  return durationMinutes(interval) * energy;
}
