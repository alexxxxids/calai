import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from 'sonner';
import { executeBlockAction } from './block-dialog';

import type { CalendarEventItem } from '../types';
import {
  calculateBlockDurationMinutes,
  formatEventTimeRange,
  getEventStatusBadge,
  isBlockActionable,
  MAX_ACTUAL_MINUTES,
  MIN_ACTUAL_MINUTES,
  validateActualMinutes,
} from './calendar-helpers';

function createMockEvent(overrides: Partial<CalendarEventItem> = {}): CalendarEventItem {
  return {
    id: 'block-123',
    title: 'Matematyka',
    start: '2026-10-05T08:00:00.000Z',
    end: '2026-10-05T09:30:00.000Z',
    color: '#3b82f6',
    editable: true,
    extendedProps: {
      kind: 'block',
      status: 'planned',
      pinned: false,
      taskId: 'task-456',
      energy: 2,
      typeId: 'type-789',
    },
    ...overrides,
  };
}

describe('block-dialog helpers and business rules', () => {
  describe('calculateBlockDurationMinutes', () => {
    it('should calculate 90 minutes when start is 08:00 and end is 09:30', () => {
      // Arrange
      const start = '2026-10-05T08:00:00.000Z';
      const end = '2026-10-05T09:30:00.000Z';

      // Act
      const result = calculateBlockDurationMinutes(start, end);

      // Assert
      expect(result).toBe(90);
    });

    it('should calculate 45 minutes when start is 10:00 and end is 10:45', () => {
      // Arrange
      const start = '2026-10-05T10:00:00.000Z';
      const end = '2026-10-05T10:45:00.000Z';

      // Act
      const result = calculateBlockDurationMinutes(start, end);

      // Assert
      expect(result).toBe(45);
    });

    it('should calculate 120 minutes when start is 14:00 and end is 16:00', () => {
      // Arrange
      const start = '2026-10-05T14:00:00.000Z';
      const end = '2026-10-05T16:00:00.000Z';

      // Act
      const result = calculateBlockDurationMinutes(start, end);

      // Assert
      expect(result).toBe(120);
    });

    it('should calculate duration from Date objects when Date instances are passed', () => {
      // Arrange
      const start = new Date('2026-10-05T08:00:00.000Z');
      const end = new Date('2026-10-05T09:00:00.000Z');

      // Act
      const result = calculateBlockDurationMinutes(start, end);

      // Assert
      expect(result).toBe(60);
    });

    it('should return 0 when start date is equal to end date', () => {
      // Arrange
      const start = '2026-10-05T08:00:00.000Z';
      const end = '2026-10-05T08:00:00.000Z';

      // Act
      const result = calculateBlockDurationMinutes(start, end);

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0 when end date is before start date', () => {
      // Arrange
      const start = '2026-10-05T10:00:00.000Z';
      const end = '2026-10-05T09:00:00.000Z';

      // Act
      const result = calculateBlockDurationMinutes(start, end);

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0 when start is invalid date string', () => {
      // Arrange
      const start = 'invalid-date';
      const end = '2026-10-05T09:00:00.000Z';

      // Act
      const result = calculateBlockDurationMinutes(start, end);

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0 when end is invalid date string', () => {
      // Arrange
      const start = '2026-10-05T08:00:00.000Z';
      const end = 'not-a-date';

      // Act
      const result = calculateBlockDurationMinutes(start, end);

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0 when start or end is null', () => {
      // Arrange & Act & Assert
      expect(calculateBlockDurationMinutes(null, '2026-10-05T09:00:00.000Z')).toBe(0);
      expect(calculateBlockDurationMinutes('2026-10-05T08:00:00.000Z', null)).toBe(0);
      expect(calculateBlockDurationMinutes(null, null)).toBe(0);
    });

    it('should return 0 when start or end is undefined', () => {
      // Arrange & Act & Assert
      expect(calculateBlockDurationMinutes(undefined, '2026-10-05T09:00:00.000Z')).toBe(0);
      expect(calculateBlockDurationMinutes('2026-10-05T08:00:00.000Z', undefined)).toBe(0);
      expect(calculateBlockDurationMinutes(undefined, undefined)).toBe(0);
    });
  });

  describe('validateActualMinutes', () => {
    it('should return isValid true and numeric minutes when input is valid integer 90', () => {
      // Arrange
      const input = 90;

      // Act
      const result = validateActualMinutes(input);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.minutes).toBe(90);
      expect(result.error).toBeUndefined();
    });

    it('should return isValid true and numeric minutes when input is numeric string "90"', () => {
      // Arrange
      const input = '90';

      // Act
      const result = validateActualMinutes(input);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.minutes).toBe(90);
      expect(result.error).toBeUndefined();
    });

    it('should return isValid true for minimum boundary of 1 minute', () => {
      // Arrange
      const input = MIN_ACTUAL_MINUTES;

      // Act
      const result = validateActualMinutes(input);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.minutes).toBe(1);
    });

    it('should return isValid true for maximum boundary of 1440 minutes', () => {
      // Arrange
      const input = MAX_ACTUAL_MINUTES;

      // Act
      const result = validateActualMinutes(input);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.minutes).toBe(1440);
    });

    it('should return isValid false when input is empty string', () => {
      // Arrange
      const input = '';

      // Act
      const result = validateActualMinutes(input);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Podaj liczbę minut');
    });

    it('should return isValid false when input is null or undefined', () => {
      // Arrange & Act & Assert
      expect(validateActualMinutes(null).isValid).toBe(false);
      expect(validateActualMinutes(null).error).toBe('Podaj liczbę minut');
      expect(validateActualMinutes(undefined).isValid).toBe(false);
      expect(validateActualMinutes(undefined).error).toBe('Podaj liczbę minut');
    });

    it('should return isValid false when input is 0', () => {
      // Arrange
      const input = 0;

      // Act
      const result = validateActualMinutes(input);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Minimalny czas to 1 minuta');
    });

    it('should return isValid false when input is negative number', () => {
      // Arrange
      const input = -15;

      // Act
      const result = validateActualMinutes(input);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Minimalny czas to 1 minuta');
    });

    it('should return isValid false when input exceeds 1440 minutes', () => {
      // Arrange
      const input = 1441;

      // Act
      const result = validateActualMinutes(input);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Maksymalny czas to 1440 minut');
    });

    it('should return isValid false when input is decimal number', () => {
      // Arrange
      const input = 45.5;

      // Act
      const result = validateActualMinutes(input);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Czas musi być liczbą całkowitą');
    });

    it('should return isValid false when input is non-numeric text', () => {
      // Arrange
      const input = 'abc';

      // Act
      const result = validateActualMinutes(input);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Czas musi być liczbą całkowitą');
    });
  });

  describe('isBlockActionable', () => {
    it('should return true when event kind is "block" and status is "planned"', () => {
      // Arrange
      const event = createMockEvent({
        extendedProps: {
          kind: 'block',
          status: 'planned',
          pinned: false,
          taskId: 't-1',
          energy: 2,
          typeId: 'type-1',
        },
      });

      // Act
      const result = isBlockActionable(event);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when block status is "done"', () => {
      // Arrange
      const event = createMockEvent({
        extendedProps: {
          kind: 'block',
          status: 'done',
          pinned: false,
          taskId: 't-1',
          energy: 2,
          typeId: 'type-1',
        },
      });

      // Act
      const result = isBlockActionable(event);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when block status is "missed"', () => {
      // Arrange
      const event = createMockEvent({
        extendedProps: {
          kind: 'block',
          status: 'missed',
          pinned: false,
          taskId: 't-1',
          energy: 2,
          typeId: 'type-1',
        },
      });

      // Act
      const result = isBlockActionable(event);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when event kind is "recurring"', () => {
      // Arrange
      const event = createMockEvent({
        extendedProps: {
          kind: 'recurring',
          status: null,
          pinned: false,
          taskId: null,
          energy: 1,
          typeId: 'type-1',
        },
      });

      // Act
      const result = isBlockActionable(event);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when event kind is "external"', () => {
      // Arrange
      const event = createMockEvent({
        extendedProps: {
          kind: 'external',
          status: null,
          pinned: false,
          taskId: null,
          energy: 1,
          typeId: 'type-1',
        },
      });

      // Act
      const result = isBlockActionable(event);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when block is null or undefined', () => {
      // Arrange & Act & Assert
      expect(isBlockActionable(null)).toBe(false);
      expect(isBlockActionable(undefined)).toBe(false);
    });
  });

  describe('dialog presentation formatting', () => {
    it('should format status badge and time range for planned event', () => {
      // Arrange
      const event = createMockEvent();
      const timeZone = 'Europe/Warsaw';

      // Act
      const badge = getEventStatusBadge(event.extendedProps.status);
      const timeRange = formatEventTimeRange(new Date(event.start), new Date(event.end), timeZone);

      // Assert
      expect(badge.text).toBe('Zaplanowany');
      expect(badge.variant).toBe('outline');
      expect(timeRange).toBe('10:00 – 11:30');
    });

    it('should format status badge and time range for completed event in UTC', () => {
      // Arrange
      const event = createMockEvent({
        extendedProps: {
          kind: 'block',
          status: 'done',
          pinned: true,
          taskId: 't-1',
          energy: 3,
          typeId: 'type-1',
        },
      });
      const timeZone = 'UTC';

      // Act
      const badge = getEventStatusBadge(event.extendedProps.status);
      const timeRange = formatEventTimeRange(new Date(event.start), new Date(event.end), timeZone);

      // Assert
      expect(badge.text).toBe('Wykonano');
      expect(badge.variant).toBe('default');
      expect(timeRange).toBe('08:00 – 09:30');
    });
  });

  describe('G3: executeBlockAction network failure handling', () => {
    it('should catch network exception and show toast error when action throws', async () => {
      // Arrange
      const mockAction = vi.fn().mockRejectedValue(new Error('Network failure'));
      const mockSuccess = vi.fn();

      // Act & Assert
      await expect(
        executeBlockAction(mockAction, mockSuccess, 'Sukces'),
      ).resolves.not.toThrow();

      expect(mockSuccess).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Błąd połączenia');
    });
  });
});
