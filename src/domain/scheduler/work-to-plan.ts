/** What the server knows about the work of one task, all in whole minutes. */
export interface WorkToPlanInput {
  /**
   * tasks.estimate_minutes. A task without an estimate is an idea, not planned work:
   * the caller skips it and never calls workToPlan for it.
   */
  readonly estimateMinutes: number;
  /** Sum of work_minutes of the task's blocks closed as "done". */
  readonly doneWorkMinutes: number;
  /**
   * Sum of work_minutes of the task's blocks that stay in `busy`, are not closed and have not ended
   * (pinned or running): they will still happen. A block that ended without being closed counts as
   * missed (FR-71), so its work is not kept here and goes back into the plan.
   */
  readonly keptWorkMinutes: number;
}

/**
 * docs/algorithms.md §6.2: minutes of work the planner still has to place for a task —
 * the estimate minus the work already done and minus the work of fixed blocks that will still happen.
 * Never below 0: work done beyond the estimate does not create negative work.
 */
export function workToPlan(input: WorkToPlanInput): number {
  const { estimateMinutes, doneWorkMinutes, keptWorkMinutes } = input;
  for (const minutes of [estimateMinutes, doneWorkMinutes, keptWorkMinutes]) {
    if (!Number.isInteger(minutes) || minutes < 0) {
      throw new RangeError(`Expected whole minutes (0 or more), got ${minutes}`);
    }
  }
  return Math.max(0, estimateMinutes - doneWorkMinutes - keptWorkMinutes);
}
