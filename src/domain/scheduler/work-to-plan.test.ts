import { describe, expect, it } from 'vitest';

import { workToPlan } from '@/domain/scheduler/work-to-plan';

describe('workToPlan', () => {
  it('should plan the whole estimate when nothing is done or kept', () => {
    expect(workToPlan({ estimateMinutes: 180, doneWorkMinutes: 0, keptWorkMinutes: 0 })).toBe(180);
  });

  it('should subtract done work when blocks were closed as done', () => {
    // docs/algorithms.md §4.4: estimate 180, the first 90-minute block is done → 90 left.
    expect(workToPlan({ estimateMinutes: 180, doneWorkMinutes: 90, keptWorkMinutes: 0 })).toBe(90);
  });

  it('should subtract kept work when fixed blocks will still happen', () => {
    // 180 − 90 done − 45 in a pinned future block = 45.
    expect(workToPlan({ estimateMinutes: 180, doneWorkMinutes: 90, keptWorkMinutes: 45 })).toBe(45);
  });

  it('should return 0 when more work was done than estimated', () => {
    expect(workToPlan({ estimateMinutes: 120, doneWorkMinutes: 150, keptWorkMinutes: 0 })).toBe(0);
  });

  it('should return 0 when done and kept work together exceed the estimate', () => {
    expect(workToPlan({ estimateMinutes: 100, doneWorkMinutes: 60, keptWorkMinutes: 60 })).toBe(0);
  });

  it('should throw when a value is not a whole number of minutes', () => {
    expect(() =>
      workToPlan({ estimateMinutes: 90.5, doneWorkMinutes: 0, keptWorkMinutes: 0 }),
    ).toThrow(RangeError);
  });

  it('should throw when a value is negative', () => {
    expect(() =>
      workToPlan({ estimateMinutes: 90, doneWorkMinutes: -30, keptWorkMinutes: 0 }),
    ).toThrow(RangeError);
  });
});
