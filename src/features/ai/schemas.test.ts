import { describe, expect, it } from 'vitest';
import {
  ConfirmDecompositionSchema,
  ConfirmTimetableSchema,
  DecompositionSchema,
  LocalDateTimeSchema,
  TimetableSchema,
} from '@/features/ai/schemas';

const TYPE_ID = '3f1c2a4e-9b7d-4c1e-8f2a-1234567890ab';

describe('DecompositionSchema', () => {
  const answer = {
    summary: 'Sprawdzian z funkcji kwadratowej',
    sessionMinutes: 90,
    topics: [{ title: 'Wykres paraboli', workMinutes: 45 }],
    warnings: [],
  };

  it('should accept an answer that follows the contract', () => {
    expect(DecompositionSchema.safeParse(answer).success).toBe(true);
  });

  it('should reject an answer when a topic is shorter than 10 minutes', () => {
    const tooShort = { ...answer, topics: [{ title: 'Wzór', workMinutes: 5 }] };

    expect(DecompositionSchema.safeParse(tooShort).success).toBe(false);
  });

  it('should reject an answer when there are no topics', () => {
    expect(DecompositionSchema.safeParse({ ...answer, topics: [] }).success).toBe(false);
  });
});

describe('TimetableSchema', () => {
  it('should reject a lesson when the time is not HH:mm', () => {
    const answer = {
      events: [{ title: 'Matematyka', weekday: 1, startTime: '8:00', endTime: '8:45' }],
      warnings: [],
    };

    expect(TimetableSchema.safeParse(answer).success).toBe(false);
  });
});

describe('LocalDateTimeSchema', () => {
  it('should accept what a datetime-local input sends', () => {
    expect(LocalDateTimeSchema.safeParse('2026-10-25T02:30').success).toBe(true);
  });

  it('should reject a moment with a zone and a day that does not exist', () => {
    expect(LocalDateTimeSchema.safeParse('2026-10-25T02:30Z').success).toBe(false);
    expect(LocalDateTimeSchema.safeParse('2026-02-30T10:00').success).toBe(false);
    expect(LocalDateTimeSchema.safeParse('2026-10-25T24:00').success).toBe(false);
  });
});

describe('ConfirmDecompositionSchema', () => {
  const draft = {
    typeId: TYPE_ID,
    priority: 1,
    deadline: '2026-10-12T08:00',
    sessionMinutes: 90,
    topics: [{ title: 'Wykres paraboli', workMinutes: 600 }],
  };

  it('should accept a draft when the work fits into 100 hours', () => {
    const topics = Array.from({ length: 10 }, () => ({ title: 'Temat', workMinutes: 600 }));

    expect(ConfirmDecompositionSchema.safeParse({ ...draft, topics }).success).toBe(true);
  });

  it('should reject a draft when the work is more than 100 hours', () => {
    // Arrange: 11 × 600 = 6600 minutes, more than tasks.estimate_minutes allows (6000).
    const topics = Array.from({ length: 11 }, () => ({ title: 'Temat', workMinutes: 600 }));

    // Act
    const result = ConfirmDecompositionSchema.safeParse({ ...draft, topics });

    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['topics']);
  });

  it('should reject a session length when it is off the 15-minute grid', () => {
    expect(ConfirmDecompositionSchema.safeParse({ ...draft, sessionMinutes: 50 }).success).toBe(
      false,
    );
  });
});

describe('ConfirmTimetableSchema', () => {
  const lesson = { title: 'Fizyka', weekday: 2, startTime: '08:00', endTime: '08:45' };
  const draft = { typeId: TYPE_ID, validFrom: '2026-10-05', validUntil: '2027-06-25', events: [lesson] };

  it('should accept a timetable when every lesson ends after it starts', () => {
    expect(ConfirmTimetableSchema.safeParse(draft).success).toBe(true);
  });

  it('should reject a lesson when it ends before it starts', () => {
    const events = [{ ...lesson, endTime: '07:45' }];

    const result = ConfirmTimetableSchema.safeParse({ ...draft, events });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['events', 0, 'endTime']);
  });

  it('should reject the dates when the end is before the start', () => {
    expect(ConfirmTimetableSchema.safeParse({ ...draft, validUntil: '2026-10-04' }).success).toBe(
      false,
    );
  });
});
