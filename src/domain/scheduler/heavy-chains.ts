import { BREAK_AFTER_HEAVY } from '@/domain/constants';
import { durationMinutes } from '@/domain/intervals';
import { minutesToMs } from '@/domain/time';
import type { Interval } from '@/domain/types';

// §6.3 check 4: demanding work is never planned for more than MAX_CONTINUOUS_HEAVY without a break.

const BREAK_MS = minutesToMs(BREAK_AFTER_HEAVY);

/**
 * Glues intervals of demanding work into chains. A pause shorter than BREAK_AFTER_HEAVY is no rest,
 * so it does not end a chain; a chain lasts from its first start to its last end.
 * As a result, two chains are always at least BREAK_AFTER_HEAVY apart.
 */
export function buildHeavyChains(intervals: readonly Interval[]): Interval[] {
  const chains: Interval[] = [];
  for (const interval of [...intervals].sort((a, b) => a.start - b.start)) {
    const last = chains.at(-1);
    if (last !== undefined && interval.start - last.end < BREAK_MS) {
      chains[chains.length - 1] = { start: last.start, end: Math.max(last.end, interval.end) };
    } else {
      chains.push(interval);
    }
  }
  return chains;
}

/**
 * Length in minutes of the chain a new demanding block would belong to. The block joins every
 * chain closer to it than BREAK_AFTER_HEAVY; chains are at least that far from each other,
 * so no further chain can be pulled in through them.
 */
export function chainMinutesWith(candidate: Interval, chains: readonly Interval[]): number {
  let start = candidate.start;
  let end = candidate.end;
  for (const chain of chains) {
    const isLinked =
      chain.start - candidate.end < BREAK_MS && candidate.start - chain.end < BREAK_MS;
    if (isLinked) {
      start = Math.min(start, chain.start);
      end = Math.max(end, chain.end);
    }
  }
  return durationMinutes({ start, end });
}

/**
 * True when the chain could link with a block inside `window`: it is closer than BREAK_AFTER_HEAVY.
 */
export function isChainNear(chain: Interval, window: Interval): boolean {
  return chain.start - window.end < BREAK_MS && window.start - chain.end < BREAK_MS;
}
