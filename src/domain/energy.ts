import {
  FALLBACK_MAX_MEAN_PACE,
  FALLBACK_MIN_CLOSED_BLOCKS,
  FALLBACK_MIN_COMPLETION,
  FALLBACK_STRESS_MULTIPLIER,
  FOCUS_INVERSION_BASE,
  MINUTES_PER_HOUR,
  NO_STRESS_MULTIPLIER,
  OVERLOAD_SCORE_COUNT,
  OVERLOAD_STEPS,
} from '@/domain/constants';

// docs/algorithms.md §5.

/** Answers of the weekly reflection, each on a 1–5 scale. */
export interface WeeklyScores {
  readonly fatigue: number;
  readonly stress: number;
  /** The only score where more is better. */
  readonly focus: number;
  readonly distractions: number;
}

/** Closed blocks of the last 7 days. */
export interface DailyMetrics {
  readonly done: number;
  readonly missed: number;
  /** Mean pace sample of the "done" blocks; null when there were none. */
  readonly meanPaceSample: number | null;
}

export interface StressInput {
  /** null when there is no reflection from the last 14 days or the reflection level is basic. */
  readonly weekly: WeeklyScores | null;
  readonly daily: DailyMetrics;
}

/**
 * Load points of an activity: hours × energy of its type.
 * Example: 6 hours of school (energy 2) = 12 points, 1.5 hours of study (energy 3) = 4.5 points.
 */
export function energyPoints(minutes: number, energy: number): number {
  return (minutes / MINUTES_PER_HOUR) * energy;
}

/**
 * Overload index 1–5 (more is worse): the mean of fatigue, stress, inverted focus and distractions.
 * Focus is inverted (6 − focus) because for focus a high score is the good one.
 */
export function overloadIndex(scores: WeeklyScores): number {
  const invertedFocus = FOCUS_INVERSION_BASE - scores.focus;
  return (
    (scores.fatigue + scores.stress + invertedFocus + scores.distractions) / OVERLOAD_SCORE_COUNT
  );
}

/**
 * Multiplier for the daily energy limit (FR-62). A fresh weekly reflection decides by its overload
 * index; without one, the daily metrics of the last 7 days decide (the fallback branch).
 * Any value below 1 switches the planner into stress mode.
 */
export function stressMultiplier(input: StressInput): number {
  if (input.weekly === null) {
    return multiplierFromDailyMetrics(input.daily);
  }
  return multiplierFromOverload(overloadIndex(input.weekly));
}

/**
 * The daily limit the planner uses: the user's limit × the stress multiplier, rounded to whole points.
 * Example: 20 × 0.75 = 15.
 */
export function effectiveEnergyLimit(baseLimit: number, multiplier: number): number {
  return Math.round(baseLimit * multiplier);
}

/**
 * Stress mode is on whenever the limit is lowered: then the planner also reserves recovery time.
 */
export function isStressMode(multiplier: number): boolean {
  return multiplier < NO_STRESS_MULTIPLIER;
}

function multiplierFromOverload(overload: number): number {
  // The steps are ordered from the worst, so the first match is the right one.
  for (const step of OVERLOAD_STEPS) {
    if (overload >= step.minOverload) {
      return step.multiplier;
    }
  }
  return NO_STRESS_MULTIPLIER;
}

function multiplierFromDailyMetrics(daily: DailyMetrics): number {
  const closedBlocks = daily.done + daily.missed;
  if (closedBlocks < FALLBACK_MIN_CLOSED_BLOCKS) {
    return NO_STRESS_MULTIPLIER; // too little data: do not punish
  }
  const completion = daily.done / closedBlocks;
  const isSlow = daily.meanPaceSample !== null && daily.meanPaceSample > FALLBACK_MAX_MEAN_PACE;
  const isOverloaded = completion < FALLBACK_MIN_COMPLETION || isSlow;
  return isOverloaded ? FALLBACK_STRESS_MULTIPLIER : NO_STRESS_MULTIPLIER;
}
