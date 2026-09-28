import {
  DEFAULT_SESSION,
  MAX_CONTINUOUS_HEAVY,
  MAX_SESSION,
  MIN_SESSION,
  SLOT,
} from '@/domain/constants';
import { clamp, floorTo } from '@/domain/math';
import { isHeavy } from '@/domain/scheduler/model';
import type { PlannerTask } from '@/domain/types';

/**
 * A valid session length: rounded DOWN to the 15-minute grid, then kept within 30–180 minutes.
 * Down, so a session never gets longer than the user asked for (50 → 45); below 30 it becomes 30.
 * Use it wherever a session length is saved (form, AI suggestion, old data) so data and plan agree.
 */
export function normalizeSessionMinutes(minutes: number): number {
  return clamp(floorTo(minutes, SLOT), MIN_SESSION, MAX_SESSION);
}

/**
 * The block length the planner aims at for a task: its normalized session (or DEFAULT_SESSION).
 * Demanding work is capped at MAX_CONTINUOUS_HEAVY: a longer block would break the break rule alone.
 */
export function sessionLength(task: PlannerTask): number {
  const session = normalizeSessionMinutes(task.sessionMinutes ?? DEFAULT_SESSION);
  return isHeavy(task.energy) ? Math.min(session, MAX_CONTINUOUS_HEAVY) : session;
}
