import { describe, expect, it } from 'vitest';
import {
  calculatePacePreview,
  CancelTaskSchema,
  CompleteTaskSchema,
  CreateTaskSchema,
  DEFAULT_PRIORITY,
  formatPacePreview,
  MAX_ESTIMATE_MINUTES,
  MAX_HARD_DURATION,
  MAX_NOTES_LENGTH,
  MAX_PRIORITY,
  MAX_SESSION_MINUTES,
  MAX_TYPE_NAME_LENGTH,
  MIN_ESTIMATE_MINUTES,
  MIN_HARD_DURATION,
  MIN_PRIORITY,
  MIN_SESSION_MINUTES,
  MIN_TYPE_NAME_LENGTH,
  normalizeTaskSession,
  UpdateTaskSchema,
} from './schemas';

const VALID_UUID = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
const WARSAW_TZ = 'Europe/Warsaw';

describe('CreateTaskSchema - typeId vs newOneOffTypeName', () => {
  it('accepts a task with valid typeId and no newOneOffTypeName', () => {
    // Arrange
    const input = {
      typeId: VALID_UUID,
      fixation: 'flexible',
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.typeId).toBe(VALID_UUID);
      expect(result.data.newOneOffTypeName).toBeUndefined();
      expect(result.data.priority).toBe(DEFAULT_PRIORITY);
      expect(result.data.estimateMinutes).toBeNull();
    }
  });

  it('accepts a task with newOneOffTypeName and no typeId', () => {
    // Arrange
    const input = {
      newOneOffTypeName: 'Naprawa kranu',
      fixation: 'flexible',
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newOneOffTypeName).toBe('Naprawa kranu');
      expect(result.data.typeId).toBeUndefined();
    }
  });

  it('rejects when both typeId and newOneOffTypeName are provided', () => {
    // Arrange
    const input = {
      typeId: VALID_UUID,
      newOneOffTypeName: 'Projekt jednorazowy',
      fixation: 'flexible',
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects when neither typeId nor newOneOffTypeName is provided', () => {
    // Arrange
    const input = {
      fixation: 'flexible',
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects when typeId is not a valid UUID', () => {
    // Arrange
    const input = {
      typeId: 'invalid-uuid-string',
      fixation: 'flexible',
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects when newOneOffTypeName is empty or only whitespace', () => {
    // Arrange
    const input = {
      newOneOffTypeName: '   ',
      fixation: 'flexible',
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects when newOneOffTypeName exceeds maximum length', () => {
    // Arrange
    const input = {
      newOneOffTypeName: 'a'.repeat(MAX_TYPE_NAME_LENGTH + 1),
      fixation: 'flexible',
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
  });

  it('accepts newOneOffTypeName with boundary lengths 1 and 60', () => {
    // Arrange & Act
    const minResult = CreateTaskSchema.safeParse({
      newOneOffTypeName: 'a'.repeat(MIN_TYPE_NAME_LENGTH),
      fixation: 'flexible',
    });
    const maxResult = CreateTaskSchema.safeParse({
      newOneOffTypeName: 'a'.repeat(MAX_TYPE_NAME_LENGTH),
      fixation: 'flexible',
    });

    // Assert
    expect(minResult.success).toBe(true);
    expect(maxResult.success).toBe(true);
  });
});

describe('CreateTaskSchema - Priority', () => {
  it('accepts priorities 1, 2, and 3', () => {
    // Arrange & Act
    const p1 = CreateTaskSchema.safeParse({ typeId: VALID_UUID, fixation: 'flexible', priority: 1 });
    const p2 = CreateTaskSchema.safeParse({ typeId: VALID_UUID, fixation: 'flexible', priority: 2 });
    const p3 = CreateTaskSchema.safeParse({ typeId: VALID_UUID, fixation: 'flexible', priority: 3 });

    // Assert
    expect(p1.success).toBe(true);
    expect(p2.success).toBe(true);
    expect(p3.success).toBe(true);
  });

  it('defaults priority to 2 when omitted', () => {
    // Arrange
    const input = { typeId: VALID_UUID, fixation: 'flexible' };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe(DEFAULT_PRIORITY);
    }
  });

  it('rejects priority below 1 and above 3', () => {
    // Arrange & Act
    const below = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'flexible',
      priority: MIN_PRIORITY - 1,
    });
    const above = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'flexible',
      priority: MAX_PRIORITY + 1,
    });

    // Assert
    expect(below.success).toBe(false);
    expect(above.success).toBe(false);
  });
});

describe('CreateTaskSchema - Estimate (Flexible)', () => {
  it('accepts boundary estimates 5 and 6000 minutes', () => {
    // Arrange & Act
    const minEst = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'flexible',
      estimateMinutes: MIN_ESTIMATE_MINUTES,
    });
    const maxEst = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'flexible',
      estimateMinutes: MAX_ESTIMATE_MINUTES,
    });

    // Assert
    expect(minEst.success).toBe(true);
    expect(maxEst.success).toBe(true);
  });

  it('rejects estimates 4 and 6001 minutes', () => {
    // Arrange & Act
    const under = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'flexible',
      estimateMinutes: MIN_ESTIMATE_MINUTES - 1,
    });
    const over = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'flexible',
      estimateMinutes: MAX_ESTIMATE_MINUTES + 1,
    });

    // Assert
    expect(under.success).toBe(false);
    expect(over.success).toBe(false);
  });

  it('accepts null and undefined estimate for backlog ideas', () => {
    // Arrange & Act
    const nullEst = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'flexible',
      estimateMinutes: null,
    });
    const undefEst = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'flexible',
    });

    // Assert
    expect(nullEst.success).toBe(true);
    expect(undefEst.success).toBe(true);
    if (nullEst.success && undefEst.success) {
      expect(nullEst.data.estimateMinutes).toBeNull();
      expect(undefEst.data.estimateMinutes).toBeNull();
    }
  });
});

describe('CreateTaskSchema - Session length (Flexible)', () => {
  it('accepts valid session lengths on 15-minute grid between 30 and 180', () => {
    // Arrange & Act
    const s30 = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'flexible',
      sessionMinutes: 30,
    });
    const s45 = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'flexible',
      sessionMinutes: 45,
    });
    const s180 = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'flexible',
      sessionMinutes: 180,
    });

    // Assert
    expect(s30.success).toBe(true);
    expect(s45.success).toBe(true);
    expect(s180.success).toBe(true);
    if (s30.success && s45.success && s180.success) {
      expect(s30.data.sessionMinutes).toBe(30);
      expect(s45.data.sessionMinutes).toBe(45);
      expect(s180.data.sessionMinutes).toBe(180);
    }
  });

  it('normalizes session length rounding down to 15-minute grid', () => {
    // Arrange
    const input = {
      typeId: VALID_UUID,
      fixation: 'flexible',
      sessionMinutes: 50,
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessionMinutes).toBe(45);
    }
  });

  it('rejects session minutes below 30 or above 180 before transformation', () => {
    // Arrange & Act
    const tooLow = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'flexible',
      sessionMinutes: MIN_SESSION_MINUTES - 1,
    });
    const tooHigh = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'flexible',
      sessionMinutes: MAX_SESSION_MINUTES + 1,
    });

    // Assert
    expect(tooLow.success).toBe(false);
    expect(tooHigh.success).toBe(false);
  });
});

describe('CreateTaskSchema - Deadline & DST transition', () => {
  it('converts Warsaw autumn DST 02:30 transition to the first UTC occurrence', () => {
    // Arrange: 2026-10-25 02:30 in Warsaw happens twice (CEST then CET).
    // The first occurrence is UTC+2 (summer time) -> 00:30 UTC.
    const input = {
      typeId: VALID_UUID,
      fixation: 'flexible',
      deadlineDate: '2026-10-25',
      deadlineTime: '02:30',
      timeZone: WARSAW_TZ,
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deadlineInstant).toBe(Date.parse('2026-10-25T00:30:00.000Z'));
      expect(result.data.deadline).toBe('2026-10-25T00:30:00.000Z');
    }
  });

  it('converts Warsaw summer deadline correctly (UTC+2)', () => {
    // Arrange
    const input = {
      typeId: VALID_UUID,
      fixation: 'flexible',
      deadlineDate: '2026-10-05',
      deadlineTime: '08:00',
      timeZone: WARSAW_TZ,
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deadlineInstant).toBe(Date.parse('2026-10-05T06:00:00.000Z'));
      expect(result.data.deadline).toBe('2026-10-05T06:00:00.000Z');
    }
  });

  it('converts Warsaw winter deadline correctly (UTC+1)', () => {
    // Arrange
    const input = {
      typeId: VALID_UUID,
      fixation: 'flexible',
      deadlineDate: '2026-11-03',
      deadlineTime: '08:00',
      timeZone: WARSAW_TZ,
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deadlineInstant).toBe(Date.parse('2026-11-03T07:00:00.000Z'));
      expect(result.data.deadline).toBe('2026-11-03T07:00:00.000Z');
    }
  });

  it('defaults deadlineTime to 23:59 when time is omitted', () => {
    // Arrange
    const input = {
      typeId: VALID_UUID,
      fixation: 'flexible',
      deadlineDate: '2026-10-05',
      timeZone: WARSAW_TZ,
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      // 2026-10-05 23:59 Warsaw (CEST, UTC+2) -> 21:59 UTC
      expect(result.data.deadlineInstant).toBe(Date.parse('2026-10-05T21:59:00.000Z'));
      expect(result.data.deadline).toBe('2026-10-05T21:59:00.000Z');
    }
  });

  it('rejects when deadlineDate is provided without timeZone', () => {
    // Arrange
    const input = {
      typeId: VALID_UUID,
      fixation: 'flexible',
      deadlineDate: '2026-10-05',
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
  });

  it('rejects invalid calendar dates like 2026-02-30', () => {
    // Arrange
    const input = {
      typeId: VALID_UUID,
      fixation: 'flexible',
      deadlineDate: '2026-02-30',
      timeZone: WARSAW_TZ,
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
  });
});

describe('CreateTaskSchema - Hard task', () => {
  it('accepts valid hard task and calculates startsAt and endsAt', () => {
    // Arrange
    const input = {
      typeId: VALID_UUID,
      fixation: 'hard',
      date: '2026-10-05',
      startTime: '10:00',
      durationMinutes: 90,
      timeZone: WARSAW_TZ,
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      // Warsaw CEST is UTC+2: 10:00 local -> 08:00 UTC, +90 min -> 09:30 UTC
      expect(result.data.startsAt).toBe('2026-10-05T08:00:00.000Z');
      expect(result.data.endsAt).toBe('2026-10-05T09:30:00.000Z');
      expect(result.data.startsAtInstant).toBe(Date.parse('2026-10-05T08:00:00.000Z'));
      expect(result.data.endsAtInstant).toBe(Date.parse('2026-10-05T09:30:00.000Z'));
    }
  });

  it('accepts boundary durations 15 and 720 minutes', () => {
    // Arrange & Act
    const minDur = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'hard',
      date: '2026-10-05',
      startTime: '10:00',
      durationMinutes: MIN_HARD_DURATION,
      timeZone: WARSAW_TZ,
    });
    const maxDur = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'hard',
      date: '2026-10-05',
      startTime: '10:00',
      durationMinutes: MAX_HARD_DURATION,
      timeZone: WARSAW_TZ,
    });

    // Assert
    expect(minDur.success).toBe(true);
    expect(maxDur.success).toBe(true);
  });

  it('rejects duration below 15 or above 720 minutes', () => {
    // Arrange & Act
    const tooShort = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'hard',
      date: '2026-10-05',
      startTime: '10:00',
      durationMinutes: MIN_HARD_DURATION - 1,
      timeZone: WARSAW_TZ,
    });
    const tooLong = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'hard',
      date: '2026-10-05',
      startTime: '10:00',
      durationMinutes: MAX_HARD_DURATION + 1,
      timeZone: WARSAW_TZ,
    });

    // Assert
    expect(tooShort.success).toBe(false);
    expect(tooLong.success).toBe(false);
  });

  it('rejects hard task missing date, startTime, or timeZone', () => {
    // Arrange & Act
    const noDate = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'hard',
      startTime: '10:00',
      durationMinutes: 60,
      timeZone: WARSAW_TZ,
    });
    const noTime = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'hard',
      date: '2026-10-05',
      durationMinutes: 60,
      timeZone: WARSAW_TZ,
    });
    const noTz = CreateTaskSchema.safeParse({
      typeId: VALID_UUID,
      fixation: 'hard',
      date: '2026-10-05',
      startTime: '10:00',
      durationMinutes: 60,
    });

    // Assert
    expect(noDate.success).toBe(false);
    expect(noTime.success).toBe(false);
    expect(noTz.success).toBe(false);
  });
});

describe('CreateTaskSchema - Notes', () => {
  it('accepts notes up to 2000 characters', () => {
    // Arrange
    const input = {
      typeId: VALID_UUID,
      fixation: 'flexible',
      notes: 'x'.repeat(MAX_NOTES_LENGTH),
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
  });

  it('rejects notes exceeding 2000 characters', () => {
    // Arrange
    const input = {
      typeId: VALID_UUID,
      fixation: 'flexible',
      notes: 'x'.repeat(MAX_NOTES_LENGTH + 1),
    };

    // Act
    const result = CreateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
  });
});

describe('UpdateTaskSchema', () => {
  it('accepts valid update with id and updates fields', () => {
    // Arrange
    const input = {
      id: VALID_UUID,
      priority: 1,
      notes: 'Zaktualizowana notatka',
      sessionMinutes: 45,
    };

    // Act
    const result = UpdateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(VALID_UUID);
      expect(result.data.taskId).toBe(VALID_UUID);
      expect(result.data.priority).toBe(1);
      expect(result.data.notes).toBe('Zaktualizowana notatka');
      expect(result.data.sessionMinutes).toBe(45);
    }
  });

  it('accepts taskId as alternate identifier', () => {
    // Arrange
    const input = {
      taskId: VALID_UUID,
      priority: 3,
    };

    // Act
    const result = UpdateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(VALID_UUID);
      expect(result.data.taskId).toBe(VALID_UUID);
      expect(result.data.priority).toBe(3);
    }
  });

  it('rejects update without id or taskId', () => {
    // Arrange
    const input = {
      priority: 1,
    };

    // Act
    const result = UpdateTaskSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
  });
});

describe('CompleteTaskSchema & CancelTaskSchema', () => {
  it('accepts valid UUID via taskId for complete and cancel', () => {
    // Arrange & Act
    const completeResult = CompleteTaskSchema.safeParse({ taskId: VALID_UUID });
    const cancelResult = CancelTaskSchema.safeParse({ taskId: VALID_UUID });

    // Assert
    expect(completeResult.success).toBe(true);
    expect(cancelResult.success).toBe(true);
    if (completeResult.success && cancelResult.success) {
      expect(completeResult.data.taskId).toBe(VALID_UUID);
      expect(cancelResult.data.taskId).toBe(VALID_UUID);
    }
  });

  it('accepts valid UUID via id for complete and cancel', () => {
    // Arrange & Act
    const completeResult = CompleteTaskSchema.safeParse({ id: VALID_UUID });
    const cancelResult = CancelTaskSchema.safeParse({ id: VALID_UUID });

    // Assert
    expect(completeResult.success).toBe(true);
    expect(cancelResult.success).toBe(true);
    if (completeResult.success && cancelResult.success) {
      expect(completeResult.data.taskId).toBe(VALID_UUID);
      expect(cancelResult.data.taskId).toBe(VALID_UUID);
    }
  });

  it('rejects empty object or invalid UUID', () => {
    // Arrange & Act
    const emptyComplete = CompleteTaskSchema.safeParse({});
    const invalidCancel = CancelTaskSchema.safeParse({ taskId: 'invalid-id' });

    // Assert
    expect(emptyComplete.success).toBe(false);
    expect(invalidCancel.success).toBe(false);
  });
});

describe('calculatePacePreview & formatPacePreview', () => {
  it('calculates preview for 180 minutes with pace 1.22 (~220 minutes)', () => {
    // Arrange
    const estimate = 180;
    const pace = 1.22;

    // Act
    const preview = calculatePacePreview(estimate, pace);
    const text = formatPacePreview(estimate, pace);

    // Assert
    // 180 * 1.22 = 219.6 -> rounded is 220 min (3 h 40 min)
    expect(preview.estimatedMinutes).toBe(180);
    expect(preview.effectiveDurationMinutes).toBe(220);
    expect(preview.formattedText).toBe('Twoja ocena: 3 h → z Twoim tempem: 3 h 40 min');
    expect(text).toBe('Twoja ocena: 3 h → z Twoim tempem: 3 h 40 min');
  });

  it('calculates preview for 60 minutes with default pace 1.0', () => {
    // Arrange & Act
    const preview = calculatePacePreview(60, 1.0);

    // Assert
    expect(preview.estimatedMinutes).toBe(60);
    expect(preview.effectiveDurationMinutes).toBe(60);
    expect(preview.formattedText).toBe('Twoja ocena: 1 h → z Twoim tempem: 1 h');
  });

  it('calculates preview for 90 minutes with pace 1.33 (~120 minutes)', () => {
    // Arrange & Act
    // 90 * 1.33 = 119.7 -> rounded is 120 min (2 h)
    const preview = calculatePacePreview(90, 1.33);

    // Assert
    expect(preview.estimatedMinutes).toBe(90);
    expect(preview.effectiveDurationMinutes).toBe(120);
    expect(preview.formattedText).toBe('Twoja ocena: 1 h 30 min → z Twoim tempem: 2 h');
  });

  it('throws RangeError for non-positive or non-finite estimate', () => {
    // Act & Assert
    expect(() => calculatePacePreview(0, 1.0)).toThrow(RangeError);
    expect(() => calculatePacePreview(-10, 1.0)).toThrow(RangeError);
    expect(() => calculatePacePreview(NaN, 1.0)).toThrow(RangeError);
  });
});

describe('normalizeTaskSession', () => {
  it('preserves null and undefined', () => {
    // Act & Assert
    expect(normalizeTaskSession(null)).toBeNull();
    expect(normalizeTaskSession(undefined)).toBeNull();
  });

  it('rounds down to 15-minute grid and clamps between 30 and 180', () => {
    // Act & Assert
    expect(normalizeTaskSession(20)).toBe(30);
    expect(normalizeTaskSession(50)).toBe(45);
    expect(normalizeTaskSession(95)).toBe(90);
    expect(normalizeTaskSession(200)).toBe(180);
  });
});
