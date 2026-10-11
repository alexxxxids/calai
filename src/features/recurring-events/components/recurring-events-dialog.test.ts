import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../actions', () => ({
  createRecurringEvents: vi.fn(),
  deleteRecurringEvent: vi.fn(),
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { toast } from 'sonner';
import { RecurringEventsDialog, WeekdayEventsSection } from './recurring-events-dialog';
import { RecurringEventForm } from './recurring-events-form';
import {
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  DEFAULT_WEEKDAY,
  executeCreateRecurringEvent,
  executeDeleteRecurringEvent,
  formatEventTimeRange,
  formatTimeShort,
  getWeekdayLabel,
  groupEventsByWeekday,
  submitRecurringEvent,
  validateRecurringEventForm,
  WEEKDAYS,
  type RecurringEventFormValues,
} from './recurring-events-helpers';
import type { RecurringEventWithRelations } from '../types';

function createMockRecurringEvent(
  overrides: Partial<RecurringEventWithRelations> = {},
): RecurringEventWithRelations {
  return {
    id: 'rec-1',
    title: 'Matematyka',
    type_id: 'type-1',
    weekday: 1,
    start_time: '08:00:00',
    end_time: '08:45:00',
    valid_from: '2026-10-01',
    valid_until: null,
    task_types: {
      id: 'type-1',
      name: 'Szkoła',
      color: '#3b82f6',
      energy: 2,
    },
    ...overrides,
  };
}

describe('recurring-events dialog helpers, validation, and presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WEEKDAYS and weekday labels', () => {
    it('should define 7 weekdays starting from Poniedziałek to Niedziela', () => {
      // Arrange & Act
      const days = WEEKDAYS;

      // Assert
      expect(days).toHaveLength(7);
      expect(days[0]?.label).toBe('Poniedziałek');
      expect(days[0]?.value).toBe(1);
      expect(days[6]?.label).toBe('Niedziela');
      expect(days[6]?.value).toBe(7);
    });

    it('should return correct Polish label for Monday (1)', () => {
      // Act & Assert
      expect(getWeekdayLabel(1)).toBe('Poniedziałek');
    });

    it('should return correct Polish label for Friday (5)', () => {
      // Act & Assert
      expect(getWeekdayLabel(5)).toBe('Piątek');
    });

    it('should return fallback label for out-of-range weekday', () => {
      // Act & Assert
      expect(getWeekdayLabel(9)).toBe('Dzień 9');
    });

    it('should have standard default constants for time and weekday', () => {
      // Act & Assert
      expect(DEFAULT_START_TIME).toBe('08:00');
      expect(DEFAULT_END_TIME).toBe('08:45');
      expect(DEFAULT_WEEKDAY).toBe(1);
    });
  });

  describe('formatTimeShort', () => {
    it('should slice seconds when time has HH:mm:ss format', () => {
      // Arrange
      const input = '08:00:00';

      // Act
      const result = formatTimeShort(input);

      // Assert
      expect(result).toBe('08:00');
    });

    it('should return time as-is when format is HH:mm', () => {
      // Arrange
      const input = '14:30';

      // Act
      const result = formatTimeShort(input);

      // Assert
      expect(result).toBe('14:30');
    });

    it('should return short string without modification when length is less than 5', () => {
      // Arrange
      const input = '8:0';

      // Act
      const result = formatTimeShort(input);

      // Assert
      expect(result).toBe('8:0');
    });
  });

  describe('formatEventTimeRange', () => {
    it('should format time range with en-dash separator', () => {
      // Arrange
      const start = '08:00:00';
      const end = '08:45:00';

      // Act
      const result = formatEventTimeRange(start, end);

      // Assert
      expect(result).toBe('08:00 – 08:45');
    });
  });

  describe('groupEventsByWeekday', () => {
    it('should return empty map when events list is empty', () => {
      // Act
      const result = groupEventsByWeekday([]);

      // Assert
      expect(result.size).toBe(0);
    });

    it('should return empty map when events is undefined', () => {
      // Act
      const result = groupEventsByWeekday(undefined);

      // Assert
      expect(result.size).toBe(0);
    });

    it('should group events by weekday and sort each day by start_time ascending', () => {
      // Arrange
      const eventLateMonday = createMockRecurringEvent({
        id: 'rec-mon-2',
        title: 'Fizyka',
        weekday: 1,
        start_time: '10:00:00',
      });
      const eventEarlyMonday = createMockRecurringEvent({
        id: 'rec-mon-1',
        title: 'Matematyka',
        weekday: 1,
        start_time: '08:00:00',
      });
      const eventTuesday = createMockRecurringEvent({
        id: 'rec-tue-1',
        title: 'Historia',
        weekday: 2,
        start_time: '09:00:00',
      });

      // Act
      const result = groupEventsByWeekday([eventLateMonday, eventTuesday, eventEarlyMonday]);

      // Assert
      expect(result.size).toBe(2);
      const mondayList = result.get(1);
      expect(mondayList).toHaveLength(2);
      expect(mondayList?.[0]?.id).toBe('rec-mon-1');
      expect(mondayList?.[1]?.id).toBe('rec-mon-2');

      const tuesdayList = result.get(2);
      expect(tuesdayList).toHaveLength(1);
      expect(tuesdayList?.[0]?.id).toBe('rec-tue-1');
    });
  });

  describe('validateRecurringEventForm', () => {
    const validForm: RecurringEventFormValues = {
      title: 'Matematyka',
      typeId: 'type-123',
      weekday: 1,
      startTime: '08:00',
      endTime: '08:45',
      validFrom: '2026-10-01',
      validUntil: '2027-06-25',
    };

    it('should return isValid true when all fields are properly filled', () => {
      // Act
      const result = validateRecurringEventForm(validForm);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return isValid true when optional validUntil is omitted', () => {
      // Arrange
      const formWithoutUntil = { ...validForm, validUntil: undefined };

      // Act
      const result = validateRecurringEventForm(formWithoutUntil);

      // Assert
      expect(result.isValid).toBe(true);
    });

    it('should return isValid false when title is empty string', () => {
      // Arrange
      const invalid = { ...validForm, title: '' };

      // Act
      const result = validateRecurringEventForm(invalid);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Nazwa zajęć jest wymagana');
    });

    it('should return isValid false when title is only whitespace', () => {
      // Arrange
      const invalid = { ...validForm, title: '   ' };

      // Act
      const result = validateRecurringEventForm(invalid);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Nazwa zajęć jest wymagana');
    });

    it('should return isValid false when title exceeds maximum length 80', () => {
      // Arrange
      const invalid = { ...validForm, title: 'A'.repeat(81) };

      // Act
      const result = validateRecurringEventForm(invalid);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Nazwa zajęć może mieć maksymalnie 80 znaków');
    });

    it('should return isValid false when typeId is empty', () => {
      // Arrange
      const invalid = { ...validForm, typeId: '' };

      // Act
      const result = validateRecurringEventForm(invalid);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Wybierz typ zadania');
    });

    it('should return isValid false when weekday is less than 1', () => {
      // Arrange
      const invalid = { ...validForm, weekday: 0 };

      // Act
      const result = validateRecurringEventForm(invalid);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Dzień tygodnia musi być między 1 a 7');
    });

    it('should return isValid false when weekday is greater than 7', () => {
      // Arrange
      const invalid = { ...validForm, weekday: 8 };

      // Act
      const result = validateRecurringEventForm(invalid);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Dzień tygodnia musi być między 1 a 7');
    });

    it('should return isValid false when startTime is missing', () => {
      // Arrange
      const invalid = { ...validForm, startTime: '' };

      // Act
      const result = validateRecurringEventForm(invalid);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Podaj czas rozpoczęcia i zakończenia');
    });

    it('should return isValid false when endTime is equal to startTime', () => {
      // Arrange
      const invalid = { ...validForm, startTime: '08:00', endTime: '08:00' };

      // Act
      const result = validateRecurringEventForm(invalid);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Czas zakończenia musi być późniejszy niż czas rozpoczęcia');
    });

    it('should return isValid false when endTime equals startTime with mixed second precision', () => {
      // Arrange
      const invalid = { ...validForm, startTime: '08:00', endTime: '08:00:00' };

      // Act
      const result = validateRecurringEventForm(invalid);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Czas zakończenia musi być późniejszy niż czas rozpoczęcia');
    });

    it('should return isValid false when endTime is earlier than startTime', () => {
      // Arrange
      const invalid = { ...validForm, startTime: '09:00', endTime: '08:00' };

      // Act
      const result = validateRecurringEventForm(invalid);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Czas zakończenia musi być późniejszy niż czas rozpoczęcia');
    });

    it('should return isValid false when validFrom is missing', () => {
      // Arrange
      const invalid = { ...validForm, validFrom: '' };

      // Act
      const result = validateRecurringEventForm(invalid);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Podaj datę początkową');
    });

    it('should return isValid false when validUntil is earlier than validFrom', () => {
      // Arrange
      const invalid = {
        ...validForm,
        validFrom: '2026-10-10',
        validUntil: '2026-10-05',
      };

      // Act
      const result = validateRecurringEventForm(invalid);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Data końcowa nie może być wcześniejsza niż początkowa');
    });

    it('should return isValid true when validUntil is equal to validFrom', () => {
      // Arrange
      const singleDay = {
        ...validForm,
        validFrom: '2026-10-10',
        validUntil: '2026-10-10',
      };

      // Act
      const result = validateRecurringEventForm(singleDay);

      // Assert
      expect(result.isValid).toBe(true);
    });
  });

  describe('executeCreateRecurringEvent', () => {
    it('should call toast.success and invoke onSuccess callback when action returns ok true', async () => {
      // Arrange
      const mockAction = vi.fn().mockResolvedValue({ ok: true });
      const mockSuccess = vi.fn();

      // Act
      await executeCreateRecurringEvent(mockAction, mockSuccess);

      // Assert
      expect(mockSuccess).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('Dodano zajęcia do planu lekcji');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should call toast.error with server message when action returns ok false', async () => {
      // Arrange
      const mockAction = vi.fn().mockResolvedValue({ ok: false, error: 'Błąd walidacji' });
      const mockSuccess = vi.fn();

      // Act
      await executeCreateRecurringEvent(mockAction, mockSuccess);

      // Assert
      expect(mockSuccess).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Błąd walidacji');
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should call toast.error with fallback message when action returns ok false without error', async () => {
      // Arrange
      const mockAction = vi.fn().mockResolvedValue({ ok: false });
      const mockSuccess = vi.fn();

      // Act
      await executeCreateRecurringEvent(mockAction, mockSuccess);

      // Assert
      expect(mockSuccess).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Nie udało się dodać zajęć');
    });

    it('should catch network exception and show connection error toast', async () => {
      // Arrange
      const mockAction = vi.fn().mockRejectedValue(new Error('Network failure'));
      const mockSuccess = vi.fn();

      // Act & Assert
      await expect(executeCreateRecurringEvent(mockAction, mockSuccess)).resolves.not.toThrow();
      expect(mockSuccess).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Błąd połączenia');
    });
  });

  describe('executeDeleteRecurringEvent', () => {
    it('should call toast.success and invoke onSuccess callback when action returns ok true', async () => {
      // Arrange
      const mockAction = vi.fn().mockResolvedValue({ ok: true });
      const mockSuccess = vi.fn();

      // Act
      await executeDeleteRecurringEvent(mockAction, mockSuccess);

      // Assert
      expect(mockSuccess).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('Usunięto zajęcia z planu lekcji');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should call toast.error with server message when action returns ok false', async () => {
      // Arrange
      const mockAction = vi.fn().mockResolvedValue({ ok: false, error: 'Wydarzenie nie istnieje' });
      const mockSuccess = vi.fn();

      // Act
      await executeDeleteRecurringEvent(mockAction, mockSuccess);

      // Assert
      expect(mockSuccess).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Wydarzenie nie istnieje');
    });

    it('should call toast.error with fallback message when action returns ok false without error', async () => {
      // Arrange
      const mockAction = vi.fn().mockResolvedValue({ ok: false });
      const mockSuccess = vi.fn();

      // Act
      await executeDeleteRecurringEvent(mockAction, mockSuccess);

      // Assert
      expect(mockSuccess).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Nie udało się usunąć zajęć');
    });

    it('should catch network exception and show connection error toast', async () => {
      // Arrange
      const mockAction = vi.fn().mockRejectedValue(new Error('Network failure'));
      const mockSuccess = vi.fn();

      // Act & Assert
      await expect(executeDeleteRecurringEvent(mockAction, mockSuccess)).resolves.not.toThrow();
      expect(mockSuccess).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Błąd połączenia');
    });
  });

  describe('submitRecurringEvent', () => {
    const validValues: RecurringEventFormValues = {
      title: 'Matematyka',
      typeId: 'type-123',
      weekday: 1,
      startTime: '08:00',
      endTime: '08:45',
      validFrom: '2026-10-01',
      validUntil: '2027-06-25',
    };

    it('should show toast error and prevent action call when validation fails', async () => {
      // Arrange
      const invalidValues = { ...validValues, title: '' };
      const mockAction = vi.fn();
      const mockSuccess = vi.fn();

      // Act
      await submitRecurringEvent(invalidValues, mockAction, mockSuccess);

      // Assert
      expect(mockAction).not.toHaveBeenCalled();
      expect(mockSuccess).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Nazwa zajęć jest wymagana');
    });

    it('should call action with formatted batch payload and invoke onSuccess when successful', async () => {
      // Arrange
      const mockAction = vi.fn().mockResolvedValue({ ok: true });
      const mockSuccess = vi.fn();

      // Act
      await submitRecurringEvent(validValues, mockAction, mockSuccess);

      // Assert
      expect(mockAction).toHaveBeenCalledWith({
        events: [
          {
            title: 'Matematyka',
            typeId: 'type-123',
            weekday: 1,
            startTime: '08:00',
            endTime: '08:45',
            validFrom: '2026-10-01',
            validUntil: '2027-06-25',
          },
        ],
      });
      expect(mockSuccess).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('Dodano zajęcia do planu lekcji');
    });

    it('should pass undefined validUntil when validUntil is whitespace or omitted', async () => {
      // Arrange
      const withoutUntil = { ...validValues, validUntil: '   ' };
      const mockAction = vi.fn().mockResolvedValue({ ok: true });
      const mockSuccess = vi.fn();

      // Act
      await submitRecurringEvent(withoutUntil, mockAction, mockSuccess);

      // Assert
      expect(mockAction).toHaveBeenCalledWith({
        events: [
          expect.objectContaining({
            validUntil: undefined,
          }),
        ],
      });
    });
  });

  describe('RecurringEventsDialog component structure', () => {
    it('should create React element with component and passed props when rendered via createElement', () => {
      // Arrange
      const taskTypes = [{ id: 'type-1', name: 'Szkoła', color: '#3b82f6' }];
      const events = [createMockRecurringEvent()];
      const onOpenChange = vi.fn();
      const onEventsChanged = vi.fn();

      // Act
      const element = React.createElement(RecurringEventsDialog, {
        open: true,
        onOpenChange,
        taskTypes,
        events,
        onEventsChanged,
      });

      // Assert
      expect(element).toBeDefined();
      expect(element.type).toBe(RecurringEventsDialog);
      expect(element.props.open).toBe(true);
      expect(element.props.onOpenChange).toBe(onOpenChange);
      expect(element.props.taskTypes).toEqual(taskTypes);
      expect(element.props.events).toEqual(events);
      expect(element.props.onEventsChanged).toBe(onEventsChanged);
    });

    it('should create React element with closed state when open is false', () => {
      // Arrange
      const onOpenChange = vi.fn();

      // Act
      const element = React.createElement(RecurringEventsDialog, {
        open: false,
        onOpenChange,
        taskTypes: [],
      });

      // Assert
      expect(element).toBeDefined();
      expect(element.props.open).toBe(false);
    });
  });

  describe('WeekdayEventsSection deletion locking (G3)', () => {
    it('should disable delete buttons for all events when deletingId is active', () => {
      // Arrange
      const events = [
        createMockRecurringEvent({ id: 'rec-1', title: 'Matematyka', weekday: 1 }),
        createMockRecurringEvent({ id: 'rec-2', title: 'Fizyka', weekday: 1 }),
      ];
      const taskTypes = [{ id: 'type-1', name: 'Szkoła', color: '#3b82f6' }];

      // Act
      const html = renderToStaticMarkup(
        React.createElement(WeekdayEventsSection, {
          events,
          taskTypes,
          onDelete: vi.fn(),
          deletingId: 'rec-1',
        }),
      );

      // Assert: Both rec-1 and rec-2 delete buttons must be disabled to prevent concurrent deletion
      const disabledCount = (html.match(/disabled=""/g) ?? html.match(/disabled(?=[ >])/g) ?? []).length;
      expect(disabledCount).toBe(2);
    });

    it('should disable delete buttons for all events when form is submitting (isSubmitting = true)', () => {
      // Arrange
      const events = [
        createMockRecurringEvent({ id: 'rec-1', title: 'Matematyka', weekday: 1 }),
        createMockRecurringEvent({ id: 'rec-2', title: 'Fizyka', weekday: 1 }),
      ];
      const taskTypes = [{ id: 'type-1', name: 'Szkoła', color: '#3b82f6' }];

      // Act
      const html = renderToStaticMarkup(
        React.createElement(WeekdayEventsSection, {
          events,
          taskTypes,
          onDelete: vi.fn(),
          deletingId: null,
          isSubmitting: true,
        }),
      );

      // Assert
      const disabledCount = (html.match(/disabled=""/g) ?? html.match(/disabled(?=[ >])/g) ?? []).length;
      expect(disabledCount).toBe(2);
    });
  });

  describe('RecurringEventForm timeZone handling (G5)', () => {
    it('should initialize validFrom date according to provided timeZone with Warsaw fallback', () => {
      // Mock Date.now to 2026-10-11T23:30:00Z (Warsaw is next day 2026-10-12, New York is 2026-10-11)
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-11T23:30:00.000Z').getTime());

      const taskTypes = [{ id: 'type-1', name: 'Szkoła', color: '#3b82f6' }];

      const htmlNy = renderToStaticMarkup(
        React.createElement(RecurringEventForm, {
          taskTypes,
          timeZone: 'America/New_York',
        }),
      );

      const htmlWarsaw = renderToStaticMarkup(
        React.createElement(RecurringEventForm, {
          taskTypes,
        }),
      );

      expect(htmlNy).toContain('value="2026-10-11"');
      expect(htmlWarsaw).toContain('value="2026-10-12"');

      nowSpy.mockRestore();
    });
  });
});

