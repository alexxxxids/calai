import { MIN_SESSION } from '@/domain/constants';
import { blockDuration, workPerSession } from '@/domain/pace';
import { findEarliestSlot } from '@/domain/scheduler/find-slot';
import type { DraftBlock, PlanContext, PlanState, TaskProgress } from '@/domain/scheduler/model';
import { sessionLength } from '@/domain/scheduler/session';

/**
 * §6.3 step 6: places the task's remaining work block by block, each at the earliest possible
 * moment, and lowers `remaining` by the work of every placed block. Stops when nothing fits;
 * what is left stays in `remaining`.
 */
export function placeRemainingWork(owner: TaskProgress, plan: PlanContext, state: PlanState): void {
  while (owner.remaining > 0) {
    const block = placeNextBlock(owner, plan, state.blocks);
    if (block === null) {
      return;
    }
    state.blocks.push(block);
    owner.remaining -= block.workMinutes;
  }
}

/** The next block of the task: a full session if it fits anywhere, otherwise ever smaller halves. */
function placeNextBlock(
  owner: TaskProgress,
  plan: PlanContext,
  blocks: readonly DraftBlock[],
): DraftBlock | null {
  const { task } = owner;
  // At least one minute of work, so that every block carries work and the loop always moves on.
  const sessionWork = Math.max(1, workPerSession(sessionLength(task), task.pace));
  const fullChunk = Math.min(owner.remaining, sessionWork);
  for (const workMinutes of shrinkingChunks(fullChunk, task.pace)) {
    const request = { task, durationMinutes: chunkDuration(workMinutes, task.pace) };
    const slot = findEarliestSlot(request, plan, blocks);
    if (slot !== null) {
      return { owner, dayIndex: slot.dayIndex, interval: slot.interval, workMinutes };
    }
  }
  return null;
}

/** Block length for a chunk of work: blockDuration, but a block is never shorter than MIN_SESSION. */
function chunkDuration(workMinutes: number, pace: number): number {
  return Math.max(MIN_SESSION, blockDuration(workMinutes, pace));
}

/**
 * Chunks of work to try, biggest first: the full chunk, then its half, a quarter… while the block
 * can still get shorter (a MIN_SESSION block cannot shrink any more).
 */
function shrinkingChunks(fullChunk: number, pace: number): number[] {
  const chunks = [fullChunk];
  let chunk = fullChunk;
  while (chunk > 1 && chunkDuration(chunk, pace) > MIN_SESSION) {
    chunk = Math.floor(chunk / 2);
    chunks.push(chunk);
  }
  return chunks;
}
