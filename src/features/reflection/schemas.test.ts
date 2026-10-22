import { describe, expect, it } from 'vitest';
import {
  MAX_MONTHLY_TEXT_LENGTH,
  MAX_WEEKLY_NOTE_LENGTH,
  MonthlyReflectionSchema,
  WeeklyReflectionSchema,
} from './schemas';

describe('features/reflection/schemas', () => {
  describe('WeeklyReflectionSchema', () => {
    it('should accept valid weekly questionnaire payload', () => {
      const payload = {
        weekStart: '2026-10-12',
        fatigue: 3,
        stress: 2,
        focus: 4,
        distractions: 1,
        note: 'Dobre tempo pracy w tym tygodniu.',
      };

      const result = WeeklyReflectionSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          weekStart: '2026-10-12',
          fatigue: 3,
          stress: 2,
          focus: 4,
          distractions: 1,
          note: 'Dobre tempo pracy w tym tygodniu.',
        });
      }
    });

    it('should transform whitespace-only or empty note to null', () => {
      const payload = {
        weekStart: '2026-10-12',
        fatigue: 1,
        stress: 1,
        focus: 5,
        distractions: 1,
        note: '   ',
      };

      const result = WeeklyReflectionSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.note).toBeNull();
      }
    });

    it('should reject scores outside 1-5 range', () => {
      const tooLow = {
        weekStart: '2026-10-12',
        fatigue: 0,
        stress: 3,
        focus: 3,
        distractions: 3,
      };
      expect(WeeklyReflectionSchema.safeParse(tooLow).success).toBe(false);

      const tooHigh = {
        weekStart: '2026-10-12',
        fatigue: 6,
        stress: 3,
        focus: 3,
        distractions: 3,
      };
      expect(WeeklyReflectionSchema.safeParse(tooHigh).success).toBe(false);
    });

    it('should reject non-integer scores', () => {
      const nonInt = {
        weekStart: '2026-10-12',
        fatigue: 2.5,
        stress: 3,
        focus: 3,
        distractions: 3,
      };
      expect(WeeklyReflectionSchema.safeParse(nonInt).success).toBe(false);
    });

    it('should reject invalid weekStart date format', () => {
      const badDate = {
        weekStart: '2026/10/12',
        fatigue: 3,
        stress: 3,
        focus: 3,
        distractions: 3,
      };
      expect(WeeklyReflectionSchema.safeParse(badDate).success).toBe(false);
    });

    it('should reject note exceeding maximum length (1000 characters)', () => {
      const tooLongNote = {
        weekStart: '2026-10-12',
        fatigue: 3,
        stress: 3,
        focus: 3,
        distractions: 3,
        note: 'a'.repeat(MAX_WEEKLY_NOTE_LENGTH + 1),
      };
      expect(WeeklyReflectionSchema.safeParse(tooLongNote).success).toBe(false);

      const maxLenNote = {
        weekStart: '2026-10-12',
        fatigue: 3,
        stress: 3,
        focus: 3,
        distractions: 3,
        note: 'a'.repeat(MAX_WEEKLY_NOTE_LENGTH),
      };
      expect(WeeklyReflectionSchema.safeParse(maxLenNote).success).toBe(true);
    });
  });

  describe('MonthlyReflectionSchema', () => {
    it('should accept valid monthly review payload', () => {
      const payload = {
        month: '2026-10-01',
        wentWell: 'Opanowanie Next.js',
        wentBadly: 'Zbyt mało snu',
        typesReview: 'Zadania szkolne wymagają lepszych przerw',
        goalsNext: 'Zdać egzaminy',
        prioritiesChange: 'Więcej czasu na projekt szkolny',
      };

      const result = MonthlyReflectionSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(payload);
      }
    });

    it('should transform empty strings to null for all text fields', () => {
      const payload = {
        month: '2026-10-01',
        wentWell: '',
        wentBadly: '   ',
        typesReview: null,
      };

      const result = MonthlyReflectionSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.wentWell).toBeNull();
        expect(result.data.wentBadly).toBeNull();
        expect(result.data.typesReview).toBeNull();
        expect(result.data.goalsNext).toBeNull();
        expect(result.data.prioritiesChange).toBeNull();
      }
    });

    it('should reject month dates not matching YYYY-MM-01 format', () => {
      expect(MonthlyReflectionSchema.safeParse({ month: '2026-10-15' }).success).toBe(false);
      expect(MonthlyReflectionSchema.safeParse({ month: '2026-10' }).success).toBe(false);
      expect(MonthlyReflectionSchema.safeParse({ month: 'invalid' }).success).toBe(false);
    });

    it('should reject text fields exceeding 4000 characters', () => {
      const tooLongPayload = {
        month: '2026-10-01',
        wentWell: 'x'.repeat(MAX_MONTHLY_TEXT_LENGTH + 1),
      };
      expect(MonthlyReflectionSchema.safeParse(tooLongPayload).success).toBe(false);

      const exactLengthPayload = {
        month: '2026-10-01',
        wentWell: 'x'.repeat(MAX_MONTHLY_TEXT_LENGTH),
      };
      expect(MonthlyReflectionSchema.safeParse(exactLengthPayload).success).toBe(true);
    });
  });
});
