import type { PRIORITY } from '@/domain/constants';

/**
 * Domain types shared by several modules. Types used by a single module live next to it
 * (WeeklyRule in recurrence.ts, WeeklyScores and DailyMetrics in energy.ts).
 */

/** A moment in time: milliseconds since 1970-01-01T00:00:00Z, the same number Date.getTime() returns. */
export type Instant = number;

/** A calendar date without a time and without a zone: 'YYYY-MM-DD'. */
export type LocalDate = string;

/** A wall-clock time without a date and without a zone: 'HH:mm'. */
export type LocalTime = string;

/**
 * A half-open time span [start, end): start is included, end is not, and end > start.
 * Half-open, so that 10:00–11:00 and 11:00–12:00 touch instead of overlapping (like tstzrange '[)').
 */
export interface Interval {
  readonly start: Instant;
  readonly end: Instant;
}

/** 1 | 2 | 3, where 1 is the most important (see PRIORITY). */
export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

/** A flexible task with work the planner still has to place. */
export interface PlannerTask {
  readonly id: string;
  readonly priority: Priority;
  readonly deadline: Instant | null;
  readonly createdAt: Instant;
  /** Energy cost of the task's type: 0 restores, 1 light, 2 medium, 3 heavy. */
  readonly energy: number;
  /** Minutes of estimated work that still need a place in the calendar. */
  readonly workToPlan: number;
  /** The task's pace (taskPace): 1.2 means it takes 20 % longer than estimated. */
  readonly pace: number;
  /** Wanted block length in minutes; null means DEFAULT_SESSION. */
  readonly sessionMinutes: number | null;
}

/** Something the planner must not move: a lesson, an external event, a pinned or started block. */
export interface BusyItem {
  readonly interval: Interval;
  /** Energy cost: counts toward the day's load and toward chains of demanding work. */
  readonly energy: number;
  /**
   * The task of a fixed block (pinned, started, of a hard task); null or absent for lessons and
   * events. Such a block counts as one of that task's sessions on the date it starts.
   */
  readonly taskId?: string | null;
}

export interface PlannerInput {
  readonly now: Instant;
  /** IANA time zone of the user, e.g. 'Europe/Warsaw'. */
  readonly timezone: string;
  readonly dayStart: LocalTime;
  readonly dayEnd: LocalTime;
  /** Effective daily limit in energy points, already multiplied by the stress multiplier. */
  readonly energyLimit: number;
  readonly stressMode: boolean;
  readonly busy: readonly BusyItem[];
  readonly tasks: readonly PlannerTask[];
}

export type PlannedBlockSource = 'planner' | 'rest';

export interface PlannedBlock {
  /** null for a recovery block. */
  readonly taskId: string | null;
  readonly interval: Interval;
  /** Minutes of estimated work the block covers; for a recovery block, its length. */
  readonly workMinutes: number;
  readonly source: PlannedBlockSource;
}

/** 'deadline': cannot be done before the deadline. 'capacity': no room left in the horizon. */
export type UnscheduledReason = 'deadline' | 'capacity';

export interface UnscheduledWork {
  readonly taskId: string;
  /** Minutes of work that did not fit. */
  readonly missingMinutes: number;
  readonly reason: UnscheduledReason;
}

export interface PlannerResult {
  readonly blocks: readonly PlannedBlock[];
  readonly unscheduled: readonly UnscheduledWork[];
}
