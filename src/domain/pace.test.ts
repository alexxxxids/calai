import { describe, expect, it } from 'vitest';

import {
  blockDuration,
  emaPace,
  paceSample,
  taskPace,
  typePace,
  workPerSession,
} from '@/domain/pace';

describe('paceSample', () => {
  it('should divide actual minutes by estimated minutes when the ratio is ordinary', () => {
    // docs/algorithms.md §4.1: planned 90, took 120.
    expect(paceSample(120, 90)).toBeCloseTo(1.3333, 4);
  });

  it('should clip to 4.0 when the block took absurdly long', () => {
    // A block left open for 6 hours: 360 / 60 = 6.
    expect(paceSample(360, 60)).toBe(4);
  });

  it('should clip to 0.25 when the block took absurdly little', () => {
    expect(paceSample(10, 90)).toBe(0.25);
  });

  it('should clip to 0.25 when the actual time is zero', () => {
    expect(paceSample(0, 90)).toBe(0.25);
  });
});

describe('emaPace', () => {
  it('should return the seed when there are no samples', () => {
    expect(emaPace([], 1.0, 0.5)).toBe(1.0);
  });

  it('should move the seed by alpha towards each sample, oldest first', () => {
    // 0.5·2 + 0.5·1 = 1.5, then 0.5·1 + 0.5·1.5 = 1.25.
    expect(emaPace([2, 1], 1.0, 0.5)).toBe(1.25);
  });

  it('should clip the result to 2.0 when samples are very slow', () => {
    // 2.5, 3.25, 3.625 before clipping.
    expect(emaPace([4, 4, 4], 1.0, 0.5)).toBe(2.0);
  });

  it('should clip the result to 0.5 when samples are very fast', () => {
    // 0.625, 0.4375 before clipping.
    expect(emaPace([0.25, 0.25], 1.0, 0.5)).toBe(0.5);
  });
});

describe('typePace', () => {
  it('should start at 1.0 when the type has no samples', () => {
    expect(typePace([])).toBe(1.0);
  });

  it('should move gently with alpha 0.2 when a sample arrives', () => {
    // 0.2·2 + 0.8·1 = 1.2.
    expect(typePace([2])).toBeCloseTo(1.2, 10);
  });

  it('should ignore samples older than the last 30', () => {
    // Arrange: one extreme old sample followed by 30 samples of exactly 1.0.
    const samples = [4, ...Array.from({ length: 30 }, () => 1)];

    // Act
    const pace = typePace(samples);

    // Assert: without the window, the old 4 would still leave 1 + 0.6·0.8^30 ≈ 1.0007.
    expect(pace).toBe(1);
  });
});

describe('taskPace', () => {
  it('should equal the type pace when the task has no samples', () => {
    expect(taskPace([], 1.2)).toBe(1.2);
  });

  it('should reach 1.1667 after one sample of 120/90 when starting from 1.0', () => {
    // docs/algorithms.md §4.4: 0.5·(4/3) + 0.5·1 = 7/6 ≈ 1.1667.
    expect(taskPace([120 / 90], 1.0)).toBeCloseTo(1.1667, 4);
  });
});

describe('blockDuration', () => {
  it('should give 105 minutes for the remaining 90 minutes of the worked example', () => {
    // docs/algorithms.md §4.4: 90 · 7/6 = 105, already on the grid.
    const pace = 0.5 * (120 / 90) + 0.5 * 1.0;

    expect(blockDuration(90, pace)).toBe(105);
  });

  it('should round up to the grid when work × pace falls between slots', () => {
    // docs/algorithms.md §4.3: 90 · 1.33 = 119.7 → 120.
    expect(blockDuration(90, 1.33)).toBe(120);
  });

  it('should not add a slot when floating point lands just above a multiple of 15', () => {
    // 45 · 1.3333333333333335 = 60.00000000000001 in floating point; the exact product is 60.
    expect(blockDuration(45, 1.3333333333333335)).toBe(60);
  });

  it('should last one slot when the work is tiny', () => {
    expect(blockDuration(5, 1.0)).toBe(15);
  });
});

describe('workPerSession', () => {
  it('should fit 75 minutes of work into a 90-minute session when the pace is 1.2', () => {
    expect(workPerSession(90, 1.2)).toBe(75);
  });

  it('should round the work down when the session does not divide evenly', () => {
    // 90 / (7/6) = 77.14…
    expect(workPerSession(90, 7 / 6)).toBe(77);
  });

  it('should not lose a minute when floating point lands just below a whole number', () => {
    // 60 / 1.3333333333333335 = 44.99999999999999 in floating point; the exact quotient is 45.
    expect(workPerSession(60, 1.3333333333333335)).toBe(45);
  });
});
