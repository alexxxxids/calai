import { describe, expect, it } from 'vitest';

import {
  effectiveEnergyLimit,
  energyPoints,
  isStressMode,
  overloadIndex,
  stressMultiplier,
  type DailyMetrics,
  type WeeklyScores,
} from '@/domain/energy';

/** Daily metrics that alone would never lower the limit. */
const CALM_DAYS: DailyMetrics = { done: 10, missed: 0, meanPaceSample: 1.0 };

/** The best possible week: overload index 1. */
const GREAT_WEEK: WeeklyScores = { fatigue: 1, stress: 1, focus: 5, distractions: 1 };

describe('energyPoints', () => {
  it('should give 12 points for 6 hours of school with energy 2', () => {
    expect(energyPoints(360, 2)).toBe(12);
  });

  it('should give 4.5 points for 1.5 hours of study with energy 3', () => {
    expect(energyPoints(90, 3)).toBe(4.5);
  });

  it('should give 0 points when the activity restores energy', () => {
    expect(energyPoints(60, 0)).toBe(0);
  });
});

describe('overloadIndex', () => {
  it('should reach 5 when every score is at its worst', () => {
    expect(overloadIndex({ fatigue: 5, stress: 5, focus: 1, distractions: 5 })).toBe(5);
  });

  it('should reach 1 when every score is at its best', () => {
    expect(overloadIndex({ fatigue: 1, stress: 1, focus: 5, distractions: 1 })).toBe(1);
  });

  it('should invert focus when computing the mean', () => {
    // (3 + 4 + (6 − 3) + 4) / 4 = 3.5
    expect(overloadIndex({ fatigue: 3, stress: 4, focus: 3, distractions: 4 })).toBe(3.5);
  });
});

describe('stressMultiplier with a weekly reflection', () => {
  // Each row: the scores, their overload index computed by hand, the multiplier from §5.2.
  it.each([
    {
      weekly: { fatigue: 5, stress: 5, focus: 2, distractions: 4 },
      overload: 4.5,
      multiplier: 0.6,
    },
    {
      weekly: { fatigue: 5, stress: 4, focus: 2, distractions: 4 },
      overload: 4.25,
      multiplier: 0.75,
    },
    {
      weekly: { fatigue: 4, stress: 4, focus: 2, distractions: 4 },
      overload: 4.0,
      multiplier: 0.75,
    },
    {
      weekly: { fatigue: 4, stress: 4, focus: 3, distractions: 4 },
      overload: 3.75,
      multiplier: 0.9,
    },
    {
      weekly: { fatigue: 3, stress: 4, focus: 3, distractions: 4 },
      overload: 3.5,
      multiplier: 0.9,
    },
    {
      weekly: { fatigue: 3, stress: 3, focus: 3, distractions: 4 },
      overload: 3.25,
      multiplier: 1.0,
    },
  ])(
    'should return $multiplier when the overload index is $overload',
    ({ weekly, overload, multiplier }) => {
      // Arrange: make sure the row really has the overload index it claims.
      expect(overloadIndex(weekly)).toBe(overload);

      // Act
      const result = stressMultiplier({ weekly, daily: CALM_DAYS });

      // Assert
      expect(result).toBe(multiplier);
    },
  );

  it('should ignore bad daily metrics when a weekly reflection exists', () => {
    const daily: DailyMetrics = { done: 0, missed: 10, meanPaceSample: null };

    expect(stressMultiplier({ weekly: GREAT_WEEK, daily })).toBe(1.0);
  });
});

describe('stressMultiplier from daily metrics (fallback)', () => {
  it('should return 1.0 when fewer than 5 blocks were closed', () => {
    const daily: DailyMetrics = { done: 0, missed: 4, meanPaceSample: null };

    expect(stressMultiplier({ weekly: null, daily })).toBe(1.0);
  });

  it('should return 0.85 when less than half of 5 closed blocks were done', () => {
    // C = 2 / 5 = 0.4
    const daily: DailyMetrics = { done: 2, missed: 3, meanPaceSample: 1.0 };

    expect(stressMultiplier({ weekly: null, daily })).toBe(0.85);
  });

  it('should return 1.0 when exactly half of the closed blocks were done', () => {
    // C = 3 / 6 = 0.5, which is not below 0.5
    const daily: DailyMetrics = { done: 3, missed: 3, meanPaceSample: 1.0 };

    expect(stressMultiplier({ weekly: null, daily })).toBe(1.0);
  });

  it('should return 0.85 when the mean pace sample is above 1.5', () => {
    const daily: DailyMetrics = { done: 5, missed: 0, meanPaceSample: 1.6 };

    expect(stressMultiplier({ weekly: null, daily })).toBe(0.85);
  });

  it('should return 1.0 when the mean pace sample is exactly 1.5', () => {
    const daily: DailyMetrics = { done: 5, missed: 0, meanPaceSample: 1.5 };

    expect(stressMultiplier({ weekly: null, daily })).toBe(1.0);
  });

  it('should return 0.85 when nothing was done even without a pace sample', () => {
    const daily: DailyMetrics = { done: 0, missed: 5, meanPaceSample: null };

    expect(stressMultiplier({ weekly: null, daily })).toBe(0.85);
  });
});

describe('effectiveEnergyLimit', () => {
  it('should multiply and keep whole points when the product is whole', () => {
    expect(effectiveEnergyLimit(20, 0.75)).toBe(15);
  });

  it('should round half up when the product ends in .5', () => {
    // 30 · 0.85 = 25.5
    expect(effectiveEnergyLimit(30, 0.85)).toBe(26);
  });

  it('should keep the limit when there is no stress', () => {
    expect(effectiveEnergyLimit(20, 1.0)).toBe(20);
  });

  it('should round like exact arithmetic for every limit the database allows', () => {
    // Floating point could turn 25.5 into 25.499999999999996 and round it the wrong way.
    // Oracle in whole numbers: limit × percent, then round half up by integer division.
    const multipliers = [
      { multiplier: 0.6, percent: 60 },
      { multiplier: 0.75, percent: 75 },
      { multiplier: 0.85, percent: 85 },
      { multiplier: 0.9, percent: 90 },
      { multiplier: 1.0, percent: 100 },
    ];
    for (let baseLimit = 4; baseLimit <= 60; baseLimit += 1) {
      for (const { multiplier, percent } of multipliers) {
        const exact = Math.floor((baseLimit * percent + 50) / 100);
        expect(effectiveEnergyLimit(baseLimit, multiplier)).toBe(exact);
      }
    }
  });
});

describe('isStressMode', () => {
  it('should be on when the multiplier lowers the limit', () => {
    expect(isStressMode(0.9)).toBe(true);
  });

  it('should be off when the multiplier is 1', () => {
    expect(isStressMode(1.0)).toBe(false);
  });
});
