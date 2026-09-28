import { describe, expect, it } from 'vitest';

import { ceilTo, clamp, floorTo, snapNearInteger } from '@/domain/math';

describe('clamp', () => {
  it('should return the value when it is inside the range', () => {
    expect(clamp(1.5, 0.5, 2)).toBe(1.5);
  });

  it('should return the minimum when the value is below the range', () => {
    expect(clamp(0.1, 0.25, 4)).toBe(0.25);
  });

  it('should return the maximum when the value is above the range', () => {
    expect(clamp(6, 0.25, 4)).toBe(4);
  });
});

describe('ceilTo', () => {
  it('should round up to the next multiple when the value is between multiples', () => {
    expect(ceilTo(119.7, 15)).toBe(120);
  });

  it('should keep the value when it already is a multiple', () => {
    expect(ceilTo(120, 15)).toBe(120);
  });

  it('should round a tiny positive value up to one step', () => {
    expect(ceilTo(0.1, 15)).toBe(15);
  });
});

describe('floorTo', () => {
  it('should round down to the previous multiple when the value is between multiples', () => {
    expect(floorTo(134, 15)).toBe(120);
  });

  it('should keep the value when it already is a multiple', () => {
    expect(floorTo(135, 15)).toBe(135);
  });
});

describe('snapNearInteger', () => {
  it('should snap a result just below a whole number to it', () => {
    // 60 / 1.3333333333333335 in floating point:
    expect(snapNearInteger(44.99999999999999)).toBe(45);
  });

  it('should snap a result just above a whole number to it', () => {
    expect(snapNearInteger(105.00000000000001)).toBe(105);
  });

  it('should keep a real fraction when the value is not a floating-point crumb', () => {
    expect(snapNearInteger(105.3)).toBe(105.3);
  });
});
