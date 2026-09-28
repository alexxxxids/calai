import {
  PACE_MAX,
  PACE_MIN,
  PACE_SAMPLE_MAX,
  PACE_SAMPLE_MIN,
  SLOT,
  TASK_PACE_ALPHA,
  TYPE_PACE_ALPHA,
  TYPE_PACE_MAX_SAMPLES,
  TYPE_PACE_SEED,
} from '@/domain/constants';
import { ceilTo, clamp, snapNearInteger } from '@/domain/math';

// docs/algorithms.md §4. Pace = how many real minutes one minute of estimated work takes.

/**
 * One pace sample r' = actual / estimated minutes of a closed "done" block, clipped to 0.25–4.0
 * so that one accident ("forgot to close the block, it counted 6 hours") cannot wreck the calibration.
 * Example: 120 minutes spent on 90 minutes of work → 1.33.
 */
export function paceSample(actualMinutes: number, workMinutes: number): number {
  return clamp(actualMinutes / workMinutes, PACE_SAMPLE_MIN, PACE_SAMPLE_MAX);
}

/**
 * Exponential moving average: starting from `seed`, every sample (oldest first) moves the pace
 * by the share `alpha` towards itself. The result is clipped to 0.5–2.0.
 * Samples must already be clipped by paceSample.
 */
export function emaPace(samples: readonly number[], seed: number, alpha: number): number {
  let pace = seed;
  for (const sample of samples) {
    pace = alpha * sample + (1 - alpha) * pace;
  }
  return clamp(pace, PACE_MIN, PACE_MAX);
}

/**
 * Pace of a task type from its closed "done" blocks, oldest first. A type has a long history,
 * so each sample moves it gently (alpha 0.2), and only the last 30 samples are used.
 */
export function typePace(samples: readonly number[]): number {
  return emaPace(samples.slice(-TYPE_PACE_MAX_SAMPLES), TYPE_PACE_SEED, TYPE_PACE_ALPHA);
}

/**
 * Pace of one task: it starts from its type's pace and follows its own samples closely (alpha 0.5).
 * A task without samples simply has the pace of its type.
 */
export function taskPace(samples: readonly number[], typePaceValue: number): number {
  return emaPace(samples, typePaceValue, TASK_PACE_ALPHA);
}

/**
 * Block length for `workMinutes` of work at `pace`: work × pace rounded up to the 15-minute grid,
 * never shorter than one slot. Example: 90 minutes of work at pace 1.33 → 119.7 → 120 minutes.
 */
export function blockDuration(workMinutes: number, pace: number): number {
  const minutesAtPace = snapNearInteger(workMinutes * pace);
  return Math.max(SLOT, ceilTo(minutesAtPace, SLOT));
}

/**
 * How many minutes of work fit into one session of `sessionMinutes` at `pace`: floor(session / pace).
 * Example: a 90-minute session at pace 1.2 holds 75 minutes of work.
 */
export function workPerSession(sessionMinutes: number, pace: number): number {
  return Math.floor(snapNearInteger(sessionMinutes / pace));
}
