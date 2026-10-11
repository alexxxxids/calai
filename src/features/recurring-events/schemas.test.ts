import { describe, expect, it } from 'vitest';
import {
  CreateRecurringEventsSchema,
  DeleteRecurringEventSchema,
  ISO_DATE_REGEX,
  ISO_WEEKDAY_MAX,
  ISO_WEEKDAY_MIN,
  POSTGRES_TIME_REGEX,
  RECURRING_EVENT_TITLE_MAX_LENGTH,
  RECURRING_EVENT_TITLE_MIN_LENGTH,
  RECURRING_EVENTS_MAX_BATCH,
  RECURRING_EVENTS_MIN_BATCH,
  RecurringEventItemSchema,
} from './schemas';

describe('recurring-events schemas', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';

  const validEventBase = {
    title: 'Matematyka',
    typeId: validUuid,
    weekday: 1,
    startTime: '08:00',
    endTime: '08:45',
    validFrom: '2026-09-01',
  };

  describe('constants', () => {
    it('has expected boundary values', () => {
      expect(RECURRING_EVENT_TITLE_MIN_LENGTH).toBe(1);
      expect(RECURRING_EVENT_TITLE_MAX_LENGTH).toBe(80);
      expect(ISO_WEEKDAY_MIN).toBe(1);
      expect(ISO_WEEKDAY_MAX).toBe(7);
      expect(RECURRING_EVENTS_MIN_BATCH).toBe(1);
      expect(RECURRING_EVENTS_MAX_BATCH).toBe(50);
    });

    it('matches valid and invalid time formats with POSTGRES_TIME_REGEX', () => {
      expect(POSTGRES_TIME_REGEX.test('00:00')).toBe(true);
      expect(POSTGRES_TIME_REGEX.test('08:00')).toBe(true);
      expect(POSTGRES_TIME_REGEX.test('23:59')).toBe(true);
      expect(POSTGRES_TIME_REGEX.test('08:45:00')).toBe(true);
      expect(POSTGRES_TIME_REGEX.test('23:59:59')).toBe(true);

      expect(POSTGRES_TIME_REGEX.test('8:00')).toBe(false);
      expect(POSTGRES_TIME_REGEX.test('24:00')).toBe(false);
      expect(POSTGRES_TIME_REGEX.test('12:60')).toBe(false);
      expect(POSTGRES_TIME_REGEX.test('12:00:60')).toBe(false);
      expect(POSTGRES_TIME_REGEX.test('invalid')).toBe(false);
    });

    it('matches valid and invalid date formats with ISO_DATE_REGEX', () => {
      expect(ISO_DATE_REGEX.test('2026-09-01')).toBe(true);
      expect(ISO_DATE_REGEX.test('2026-12-31')).toBe(true);

      expect(ISO_DATE_REGEX.test('01-09-2026')).toBe(false);
      expect(ISO_DATE_REGEX.test('2026/09/01')).toBe(false);
      expect(ISO_DATE_REGEX.test('2026-9-1')).toBe(false);
      expect(ISO_DATE_REGEX.test('invalid')).toBe(false);
    });
  });

  describe('RecurringEventItemSchema', () => {
    it('accepts valid minimal input without validUntil', () => {
      const result = RecurringEventItemSchema.safeParse(validEventBase);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Matematyka');
        expect(result.data.typeId).toBe(validUuid);
        expect(result.data.weekday).toBe(1);
        expect(result.data.startTime).toBe('08:00');
        expect(result.data.endTime).toBe('08:45');
        expect(result.data.validFrom).toBe('2026-09-01');
        expect(result.data.validUntil).toBeUndefined();
      }
    });

    it('accepts valid input with validUntil string', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        validUntil: '2026-12-31',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.validUntil).toBe('2026-12-31');
      }
    });

    it('accepts valid input with validUntil equal to validFrom', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        validUntil: '2026-09-01',
      });

      expect(result.success).toBe(true);
    });

    it('accepts valid input with validUntil as null', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        validUntil: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.validUntil).toBeNull();
      }
    });

    it('accepts valid input with empty string validUntil coerced to null (G7)', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        validUntil: '',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.validUntil).toBeNull();
      }
    });

    it('rejects non-existent calendar date for validFrom (G6)', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        validFrom: '2026-02-31',
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-existent calendar date for validUntil (G6)', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        validFrom: '2026-01-01',
        validUntil: '2026-02-31',
      });

      expect(result.success).toBe(false);
    });

    it('accepts title with exactly 1 character', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        title: 'A',
      });

      expect(result.success).toBe(true);
    });

    it('accepts title with exactly 80 characters', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        title: 'X'.repeat(80),
      });

      expect(result.success).toBe(true);
    });

    it('trims whitespace around title', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        title: '   Fizyka   ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Fizyka');
      }
    });

    it('rejects empty title', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        title: '',
      });

      expect(result.success).toBe(false);
    });

    it('rejects whitespace-only title', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        title: '     ',
      });

      expect(result.success).toBe(false);
    });

    it('rejects title longer than 80 characters', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        title: 'X'.repeat(81),
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid typeId format', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        typeId: 'not-a-valid-uuid',
      });

      expect(result.success).toBe(false);
    });

    it('accepts weekday on boundaries 1 and 7', () => {
      const monday = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        weekday: 1,
      });
      const sunday = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        weekday: 7,
      });

      expect(monday.success).toBe(true);
      expect(sunday.success).toBe(true);
    });

    it('rejects weekday less than 1', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        weekday: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects weekday greater than 7', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        weekday: 8,
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-integer weekday', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        weekday: 3.5,
      });

      expect(result.success).toBe(false);
    });

    it('accepts times with seconds', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        startTime: '08:00:00',
        endTime: '08:45:00',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid startTime format', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        startTime: '8:00',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid endTime format', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        endTime: '25:00',
      });

      expect(result.success).toBe(false);
    });

    it('rejects when endTime equals startTime', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        startTime: '08:00',
        endTime: '08:00',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Czas zakończenia musi być późniejszy niż czas rozpoczęcia',
        );
        expect(result.error.issues[0]?.path).toEqual(['endTime']);
      }
    });

    it('rejects when endTime equals startTime with mixed second precision', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        startTime: '08:00:00',
        endTime: '08:00',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Czas zakończenia musi być późniejszy niż czas rozpoczęcia',
        );
      }
    });

    it('rejects when endTime is earlier than startTime', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        startTime: '09:00',
        endTime: '08:00',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Czas zakończenia musi być późniejszy niż czas rozpoczęcia',
        );
      }
    });

    it('rejects invalid validFrom date format', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        validFrom: '2026/09/01',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid validUntil date format', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        validUntil: 'not-a-date',
      });

      expect(result.success).toBe(false);
    });

    it('rejects when validUntil is earlier than validFrom', () => {
      const result = RecurringEventItemSchema.safeParse({
        ...validEventBase,
        validFrom: '2026-09-01',
        validUntil: '2026-08-31',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Data końcowa nie może być wcześniejsza niż początkowa',
        );
        expect(result.error.issues[0]?.path).toEqual(['validUntil']);
      }
    });
  });

  describe('CreateRecurringEventsSchema', () => {
    it('accepts batch with 1 valid event', () => {
      const result = CreateRecurringEventsSchema.safeParse({
        events: [validEventBase],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.events).toHaveLength(1);
      }
    });

    it('accepts batch with multiple valid events', () => {
      const secondEvent = {
        title: 'Informatyka',
        typeId: validUuid,
        weekday: 2,
        startTime: '10:00',
        endTime: '11:30',
        validFrom: '2026-09-01',
      };

      const result = CreateRecurringEventsSchema.safeParse({
        events: [validEventBase, secondEvent],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.events).toHaveLength(2);
      }
    });

    it('rejects empty events array', () => {
      const result = CreateRecurringEventsSchema.safeParse({
        events: [],
      });

      expect(result.success).toBe(false);
    });

    it('rejects batch exceeding 50 events', () => {
      const tooManyEvents = Array.from({ length: 51 }, (_, i) => ({
        ...validEventBase,
        title: `Lekcja ${i + 1}`,
      }));

      const result = CreateRecurringEventsSchema.safeParse({
        events: tooManyEvents,
      });

      expect(result.success).toBe(false);
    });

    it('rejects batch containing an invalid event', () => {
      const invalidEvent = {
        ...validEventBase,
        weekday: 9,
      };

      const result = CreateRecurringEventsSchema.safeParse({
        events: [validEventBase, invalidEvent],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('DeleteRecurringEventSchema', () => {
    it('accepts valid event id', () => {
      const result = DeleteRecurringEventSchema.safeParse({
        id: validUuid,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(validUuid);
      }
    });

    it('rejects invalid uuid', () => {
      const result = DeleteRecurringEventSchema.safeParse({
        id: 'bad-id',
      });

      expect(result.success).toBe(false);
    });

    it('rejects missing id', () => {
      const result = DeleteRecurringEventSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });
});
