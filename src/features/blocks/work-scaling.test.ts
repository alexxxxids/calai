import { describe, expect, it } from 'vitest';
import { scaleWorkMinutes } from './work-scaling';

describe('scaleWorkMinutes', () => {
  it('stretches work proportionally when duration doubles (45 min in 60 min block -> 120 min block = 90 min work)', () => {
    const result = scaleWorkMinutes(45, 60, 120);
    expect(result).toBe(90);
  });

  it('shrinks work proportionally when duration is halved (60 min in 90 min block -> 45 min block = 30 min work)', () => {
    const result = scaleWorkMinutes(60, 90, 45);
    expect(result).toBe(30);
  });

  it('preserves work minutes when duration is unchanged (60 min in 60 min block -> 60 min block = 60 min work)', () => {
    const result = scaleWorkMinutes(60, 60, 60);
    expect(result).toBe(60);
  });

  it('rounds to the nearest whole minute', () => {
    // 20 min in 60 min block resized to 75 min: (20 * 75) / 60 = 25 min
    expect(scaleWorkMinutes(20, 60, 75)).toBe(25);
    // 10 min in 60 min block resized to 25 min: (10 * 25) / 60 = 4.166... -> 4 min
    expect(scaleWorkMinutes(10, 60, 25)).toBe(4);
    // 10 min in 60 min block resized to 35 min: (10 * 35) / 60 = 5.833... -> 6 min
    expect(scaleWorkMinutes(10, 60, 35)).toBe(6);
  });

  it('clamps to lower bound of 1 minute when scaled value rounds to zero', () => {
    // 1 min in 60 min block resized to 15 min: (1 * 15) / 60 = 0.25 -> 0, clamped to 1
    const result = scaleWorkMinutes(1, 60, 15);
    expect(result).toBe(1);
  });

  it('clamps to upper bound of 1440 minutes (24 hours) when scaled value exceeds it', () => {
    // 1000 min in 60 min block resized to 120 min: (1000 * 120) / 60 = 2000, clamped to 1440
    const result = scaleWorkMinutes(1000, 60, 120);
    expect(result).toBe(1440);
  });

  it('returns oldWorkMinutes when oldDurationMinutes is 0 to prevent division by zero', () => {
    const result = scaleWorkMinutes(45, 0, 120);
    expect(result).toBe(45);
  });

  it('returns oldWorkMinutes when oldDurationMinutes is negative', () => {
    const result = scaleWorkMinutes(45, -60, 120);
    expect(result).toBe(45);
  });

  it('returns oldWorkMinutes when any argument is not a finite number', () => {
    expect(scaleWorkMinutes(NaN, 60, 120)).toBeNaN();
    expect(scaleWorkMinutes(45, Infinity, 120)).toBe(45);
    expect(scaleWorkMinutes(45, 60, Infinity)).toBe(45);
  });
});
