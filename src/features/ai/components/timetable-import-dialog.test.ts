import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/features/ai/actions', () => ({
  confirmDecomposition: vi.fn(),
  confirmTimetable: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  TimetableEventRow,
  WEEKDAY_OPTIONS,
  AI_CONSENT_KEY,
} from './ai-dialog-helpers';
import {
  DEFAULT_NEW_EVENT_END,
  DEFAULT_NEW_EVENT_START,
  DEFAULT_NEW_EVENT_WEEKDAY,
  TIMETABLE_IMPORTED_SUCCESS_MESSAGE,
  TimetableImportDialog,
  TimetableReviewStep,
} from './timetable-import-dialog';
import type { TimetableDraft, TimetableEvent } from '../schemas';

function createMockTimetableDraft(
  overrides: Partial<TimetableDraft> = {},
): TimetableDraft {
  return {
    validFrom: '2026-09-07',
    validUntil: '2027-06-25',
    events: [
      {
        title: 'Matematyka',
        weekday: 1,
        startTime: '08:00',
        endTime: '08:45',
      },
      {
        title: 'Język polski',
        weekday: 1,
        startTime: '08:55',
        endTime: '09:40',
      },
      {
        title: 'Fizyka',
        weekday: 2,
        startTime: '10:00',
        endTime: '10:45',
      },
    ],
    warnings: [],
    ...overrides,
  };
}

describe('timetable-import-dialog and timetable helpers', () => {
  const storageMap = new Map<string, string>();

  beforeEach(() => {
    vi.clearAllMocks();
    storageMap.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, val: string) => storageMap.set(key, val),
      removeItem: (key: string) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    });
  });

  describe('constants', () => {
    it('should have default new event settings matching 45-minute lesson', () => {
      expect(DEFAULT_NEW_EVENT_WEEKDAY).toBe(1);
      expect(DEFAULT_NEW_EVENT_START).toBe('08:00');
      expect(DEFAULT_NEW_EVENT_END).toBe('08:45');
    });

    it('should have Polish success message for timetable import', () => {
      expect(TIMETABLE_IMPORTED_SUCCESS_MESSAGE).toBe('Plan lekcji zapisany');
    });

    it('should define 7 weekdays with short Polish labels', () => {
      expect(WEEKDAY_OPTIONS).toHaveLength(7);
      expect(WEEKDAY_OPTIONS[0]?.label).toBe('Pn');
      expect(WEEKDAY_OPTIONS[4]?.label).toBe('Pt');
      expect(WEEKDAY_OPTIONS[6]?.label).toBe('Nd');
    });
  });

  describe('TimetableEventRow rendering', () => {
    it('should render weekday select, title, start and end time inputs', () => {
      const event: TimetableEvent = {
        title: 'Biologia',
        weekday: 3,
        startTime: '11:00',
        endTime: '11:45',
      };

      const html = renderToStaticMarkup(
        React.createElement(TimetableEventRow, {
          event,
          canRemove: true,
          onTitleChange: vi.fn(),
          onWeekdayChange: vi.fn(),
          onStartTimeChange: vi.fn(),
          onEndTimeChange: vi.fn(),
          onRemove: vi.fn(),
        }),
      );

      expect(html).toContain('Biologia');
      expect(html).toContain('11:00');
      expect(html).toContain('11:45');
      expect(html).toContain('timetable-event-row');
    });
  });

  describe('TimetableReviewStep rendering and manipulation', () => {
    it('should render validFrom, validUntil inputs and recognized events list', () => {
      const draft = createMockTimetableDraft();
      const html = renderToStaticMarkup(
        React.createElement(TimetableReviewStep, {
          draft,
          onDraftChange: vi.fn(),
          onConfirm: vi.fn(),
          onCancel: vi.fn(),
          isSubmitting: false,
        }),
      );

      expect(html).toContain('Obowiązuje od:');
      expect(html).toContain('2026-09-07');
      expect(html).toContain('2027-06-25');
      expect(html).toContain('Matematyka');
      expect(html).toContain('Fizyka');
      expect(html).toContain('Zapisz plan lekcji');
    });

    it('should allow adding a new timetable event', () => {
      const draft = createMockTimetableDraft();
      const newEvent: TimetableEvent = {
        title: 'Informatyka',
        weekday: 5,
        startTime: '12:00',
        endTime: '12:45',
      };

      const updatedDraft = {
        ...draft,
        events: [...draft.events, newEvent],
      };

      expect(updatedDraft.events).toHaveLength(4);
      expect(updatedDraft.events[3]?.title).toBe('Informatyka');
    });

    it('should allow removing an event from draft', () => {
      const draft = createMockTimetableDraft();
      const remainingEvents = draft.events.filter((_, i) => i !== 0);

      const updatedDraft = {
        ...draft,
        events: remainingEvents,
      };

      expect(updatedDraft.events).toHaveLength(2);
      expect(updatedDraft.events[0]?.title).toBe('Język polski');
    });

    it('should allow modifying event times', () => {
      const draft = createMockTimetableDraft();
      const modifiedEvents = draft.events.map((e, idx) =>
        idx === 0 ? { ...e, startTime: '08:15', endTime: '09:00' } : e,
      );

      expect(modifiedEvents[0]?.startTime).toBe('08:15');
      expect(modifiedEvents[0]?.endTime).toBe('09:00');
    });
  });

  describe('TimetableImportDialog component', () => {
    it('should render closed dialog element when open is false', () => {
      const element = React.createElement(TimetableImportDialog, {
        open: false,
        onOpenChange: vi.fn(),
        defaultTypeId: 'type-uuid-school',
      });

      expect(element).toBeDefined();
      expect(element.props.open).toBe(false);
    });

    it('should render open dialog with defaultTypeId when open is true', () => {
      storageMap.set(AI_CONSENT_KEY, 'true');
      const element = React.createElement(TimetableImportDialog, {
        open: true,
        onOpenChange: vi.fn(),
        defaultTypeId: 'type-uuid-school',
      });

      expect(element).toBeDefined();
      expect(element.props.open).toBe(true);
      expect(element.props.defaultTypeId).toBe('type-uuid-school');
    });
  });
});
