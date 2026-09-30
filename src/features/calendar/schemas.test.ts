import { describe, expect, it } from 'vitest';

import { calendarQuerySchema } from './schemas';

describe('calendarQuerySchema', () => {
  it('should accept valid 7-day range in ISO format', () => {
    // Arrange
    const input = {
      start: '2026-10-05T00:00:00.000Z',
      end: '2026-10-12T00:00:00.000Z',
    };

    // Act
    const result = calendarQuerySchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.start).toBe('2026-10-05T00:00:00.000Z');
      expect(result.data.end).toBe('2026-10-12T00:00:00.000Z');
    }
  });

  it('should accept valid range with timezone offset (e.g. +02:00)', () => {
    // Arrange
    const input = {
      start: '2026-10-05T00:00:00+02:00',
      end: '2026-10-12T00:00:00+02:00',
    };

    // Act
    const result = calendarQuerySchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.start).toBe('2026-10-05T00:00:00+02:00');
      expect(result.data.end).toBe('2026-10-12T00:00:00+02:00');
    }
  });

  it('should accept valid range of exactly 62 days', () => {
    // Arrange: 62 days = 62 * 24 * 3600 * 1000 ms
    const input = {
      start: '2026-10-01T00:00:00.000Z',
      end: '2026-12-02T00:00:00.000Z',
    };

    // Act
    const result = calendarQuerySchema.safeParse(input);

    // Assert
    expect(result.success).toBe(true);
  });

  it('should reject when start date is not a valid ISO datetime string', () => {
    // Arrange
    const input = {
      start: 'not-a-date',
      end: '2026-10-12T00:00:00.000Z',
    };

    // Act
    const result = calendarQuerySchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('start'));
      expect(issue).toBeDefined();
      expect(issue?.message).toBe('Nieprawidłowy format daty początkowej (oczekiwano ISO)');
    }
  });

  it('should reject when end date is not a valid ISO datetime string', () => {
    // Arrange
    const input = {
      start: '2026-10-05T00:00:00.000Z',
      end: '2026-10-12',
    };

    // Act
    const result = calendarQuerySchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('end'));
      expect(issue).toBeDefined();
      expect(issue?.message).toBe('Nieprawidłowy format daty końcowej (oczekiwano ISO)');
    }
  });

  it('should reject when end date equals start date', () => {
    // Arrange
    const input = {
      start: '2026-10-05T10:00:00.000Z',
      end: '2026-10-05T10:00:00.000Z',
    };

    // Act
    const result = calendarQuerySchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('end'));
      expect(issue?.message).toBe('Koniec zakresu musi być późniejszy niż początek');
    }
  });

  it('should reject when end date is earlier than start date', () => {
    // Arrange
    const input = {
      start: '2026-10-10T00:00:00.000Z',
      end: '2026-10-05T00:00:00.000Z',
    };

    // Act
    const result = calendarQuerySchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('end'));
      expect(issue?.message).toBe('Koniec zakresu musi być późniejszy niż początek');
    }
  });

  it('should reject when range exceeds 62 days (e.g. 63 days)', () => {
    // Arrange: 63 days
    const input = {
      start: '2026-10-01T00:00:00.000Z',
      end: '2026-12-03T00:00:00.000Z',
    };

    // Act
    const result = calendarQuerySchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('end'));
      expect(issue?.message).toBe('Zakres nie może przekraczać 62 dni');
    }
  });

  it('should reject when start or end are missing', () => {
    // Arrange
    const missingStart = { end: '2026-10-12T00:00:00.000Z' };
    const missingEnd = { start: '2026-10-05T00:00:00.000Z' };

    // Act & Assert
    expect(calendarQuerySchema.safeParse(missingStart).success).toBe(false);
    expect(calendarQuerySchema.safeParse(missingEnd).success).toBe(false);
  });
});
