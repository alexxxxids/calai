import { MAX_WORK_MINUTES, MIN_WORK_MINUTES } from './schemas';

/**
 * Proportionally scales work minutes when a block is resized (FR-42).
 * Clamps the result between MIN_WORK_MINUTES (1) and MAX_WORK_MINUTES (1440).
 * If oldDurationMinutes is non-positive or non-finite, returns oldWorkMinutes without division.
 */
export function scaleWorkMinutes(
  oldWorkMinutes: number,
  oldDurationMinutes: number,
  newDurationMinutes: number,
): number {
  if (oldDurationMinutes <= 0 || !Number.isFinite(oldDurationMinutes)) {
    return oldWorkMinutes;
  }
  if (!Number.isFinite(oldWorkMinutes) || !Number.isFinite(newDurationMinutes)) {
    return oldWorkMinutes;
  }
  const scaled = Math.round((oldWorkMinutes * newDurationMinutes) / oldDurationMinutes);
  return Math.min(MAX_WORK_MINUTES, Math.max(MIN_WORK_MINUTES, scaled));
}
