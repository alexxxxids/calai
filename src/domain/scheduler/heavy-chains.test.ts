import { describe, expect, it } from 'vitest';

import { buildHeavyChains, chainMinutesWith, isChainNear } from '@/domain/scheduler/heavy-chains';
import type { Interval } from '@/domain/types';

/** An interval on 2026-10-05 between two UTC times. */
function span(start: string, end: string): Interval {
  return { start: Date.parse(`2026-10-05T${start}:00Z`), end: Date.parse(`2026-10-05T${end}:00Z`) };
}

describe('buildHeavyChains', () => {
  it('should return no chains when there is no demanding work', () => {
    expect(buildHeavyChains([])).toEqual([]);
  });

  it('should glue two pieces when the pause between them is shorter than 20 minutes', () => {
    expect(buildHeavyChains([span('08:00', '09:00'), span('09:15', '10:00')])).toEqual([
      span('08:00', '10:00'),
    ]);
  });

  it('should keep two chains when the pause is exactly 20 minutes', () => {
    expect(buildHeavyChains([span('08:00', '09:00'), span('09:20', '10:00')])).toEqual([
      span('08:00', '09:00'),
      span('09:20', '10:00'),
    ]);
  });

  it('should sort the pieces and swallow overlapping ones', () => {
    expect(buildHeavyChains([span('09:30', '10:00'), span('08:00', '09:45')])).toEqual([
      span('08:00', '10:00'),
    ]);
  });
});

describe('chainMinutesWith', () => {
  it('should return the length of the block when no chain is near', () => {
    expect(chainMinutesWith(span('12:00', '13:00'), [span('08:00', '09:00')])).toBe(60);
  });

  it('should add a chain that ends less than 20 minutes before the block', () => {
    // 08:00–09:00, pause 10 min, block 09:10–10:00: 08:00–10:00 = 120 min.
    expect(chainMinutesWith(span('09:10', '10:00'), [span('08:00', '09:00')])).toBe(120);
  });

  it('should add a chain that starts less than 20 minutes after the block', () => {
    expect(chainMinutesWith(span('07:00', '07:50'), [span('08:00', '09:00')])).toBe(120);
  });

  it('should join the chains on both sides when the block bridges them', () => {
    // 08:00–09:00, block 09:10–09:40, 09:50–10:30: 08:00–10:30 = 150 min.
    expect(
      chainMinutesWith(span('09:10', '09:40'), [span('08:00', '09:00'), span('09:50', '10:30')]),
    ).toBe(150);
  });

  it('should not join a chain that is exactly 20 minutes away', () => {
    expect(chainMinutesWith(span('09:20', '10:00'), [span('08:00', '09:00')])).toBe(40);
  });
});

describe('isChainNear', () => {
  it('should be true when the chain ends less than 20 minutes before the window', () => {
    expect(isChainNear(span('07:00', '07:45'), span('08:00', '22:00'))).toBe(true);
  });

  it('should be false when the chain ends 20 minutes before the window', () => {
    expect(isChainNear(span('07:00', '07:40'), span('08:00', '22:00'))).toBe(false);
  });
});
