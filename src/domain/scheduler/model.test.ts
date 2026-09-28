import { describe, expect, it } from 'vitest';

import { blockEnergy, energyMinutes, isHeavy, type DraftBlock } from '@/domain/scheduler/model';
import type { Interval, PlannerTask } from '@/domain/types';

const NINETY_MINUTES: Interval = {
  start: Date.parse('2026-10-05T08:00:00Z'),
  end: Date.parse('2026-10-05T09:30:00Z'),
};

describe('isHeavy', () => {
  it('should treat energy 2 and more as demanding', () => {
    expect(isHeavy(2)).toBe(true);
    expect(isHeavy(3)).toBe(true);
  });

  it('should treat energy below 2 as light', () => {
    expect(isHeavy(1)).toBe(false);
    expect(isHeavy(0)).toBe(false);
  });
});

describe('blockEnergy', () => {
  it('should be 0 for a recovery block', () => {
    const recovery: DraftBlock = {
      owner: null,
      dayIndex: 0,
      interval: NINETY_MINUTES,
      workMinutes: 90,
    };

    expect(blockEnergy(recovery)).toBe(0);
  });

  it("should be the task's energy for a task block", () => {
    const task: PlannerTask = {
      id: 'a',
      priority: 2,
      deadline: null,
      createdAt: 0,
      energy: 3,
      workToPlan: 90,
      pace: 1,
      sessionMinutes: null,
    };
    const block: DraftBlock = {
      owner: { task, remaining: 0, isQueued: false, hasEvicted: false },
      dayIndex: 0,
      interval: NINETY_MINUTES,
      workMinutes: 90,
    };

    expect(blockEnergy(block)).toBe(3);
  });
});

describe('energyMinutes', () => {
  it('should multiply minutes by energy', () => {
    // 90 minutes of energy 3 = 270 energy-minutes = 4.5 points.
    expect(energyMinutes(NINETY_MINUTES, 3)).toBe(270);
  });
});
