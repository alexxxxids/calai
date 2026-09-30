import { describe, expect, it } from 'vitest';

import {
  expandRecurringToCalendarEvents,
  mapBlockToCalendarEvent,
  mapExternalToCalendarEvent,
} from './event-mappers';
import type {
  CalendarRange,
  RawBlockWithRelations,
  RawExternalWithRelations,
  RawRecurringWithRelations,
  TaskTypeItem,
} from './types';

describe('event-mappers', () => {
  describe('mapBlockToCalendarEvent - editable rules', () => {
    const baseType: TaskTypeItem = {
      id: 'type-1',
      name: 'Programowanie',
      color: '#10b981',
      energy: 3,
    };

    it('should be editable when planned and fixation is flexible', () => {
      // Arrange
      const row: RawBlockWithRelations = {
        id: 'block-1',
        starts_at: '2026-10-05T08:00:00.000Z',
        ends_at: '2026-10-05T09:30:00.000Z',
        status: 'planned',
        pinned: false,
        source: 'manual',
        task_id: 'task-1',
        tasks: {
          id: 'task-1',
          fixation: 'flexible',
          type_id: 'type-1',
          task_types: baseType,
        },
      };

      // Act
      const event = mapBlockToCalendarEvent(row);

      // Assert
      expect(event.editable).toBe(true);
      expect(event.extendedProps.status).toBe('planned');
    });

    it('should not be editable when planned but fixation is hard', () => {
      // Arrange
      const row: RawBlockWithRelations = {
        id: 'block-2',
        starts_at: '2026-10-05T08:00:00.000Z',
        ends_at: '2026-10-05T09:30:00.000Z',
        status: 'planned',
        pinned: true,
        source: 'manual',
        task_id: 'task-2',
        tasks: {
          id: 'task-2',
          fixation: 'hard',
          type_id: 'type-1',
          task_types: baseType,
        },
      };

      // Act
      const event = mapBlockToCalendarEvent(row);

      // Assert
      expect(event.editable).toBe(false);
    });

    it('should not be editable when done even if fixation is flexible', () => {
      // Arrange
      const row: RawBlockWithRelations = {
        id: 'block-3',
        starts_at: '2026-10-05T08:00:00.000Z',
        ends_at: '2026-10-05T09:30:00.000Z',
        status: 'done',
        pinned: false,
        source: 'manual',
        task_id: 'task-1',
        tasks: {
          id: 'task-1',
          fixation: 'flexible',
          type_id: 'type-1',
          task_types: baseType,
        },
      };

      // Act
      const event = mapBlockToCalendarEvent(row);

      // Assert
      expect(event.editable).toBe(false);
      expect(event.extendedProps.status).toBe('done');
    });

    it('should not be editable when missed even if fixation is flexible', () => {
      // Arrange
      const row: RawBlockWithRelations = {
        id: 'block-4',
        starts_at: '2026-10-05T08:00:00.000Z',
        ends_at: '2026-10-05T09:30:00.000Z',
        status: 'missed',
        pinned: false,
        source: 'manual',
        task_id: 'task-1',
        tasks: {
          id: 'task-1',
          fixation: 'flexible',
          type_id: 'type-1',
          task_types: baseType,
        },
      };

      // Act
      const event = mapBlockToCalendarEvent(row);

      // Assert
      expect(event.editable).toBe(false);
      expect(event.extendedProps.status).toBe('missed');
    });

    it('should not be editable when block is a rest block', () => {
      // Arrange
      const row: RawBlockWithRelations = {
        id: 'block-rest-1',
        starts_at: '2026-10-05T12:00:00.000Z',
        ends_at: '2026-10-05T13:00:00.000Z',
        status: 'planned',
        pinned: false,
        source: 'rest',
        task_id: null,
        tasks: null,
      };

      // Act
      const event = mapBlockToCalendarEvent(row);

      // Assert
      expect(event.editable).toBe(false);
      expect(event.title).toBe('Odpoczynek');
      expect(event.extendedProps.taskId).toBeNull();
      expect(event.extendedProps.energy).toBe(0);
    });
  });

  describe('mapBlockToCalendarEvent - colors and fallbacks', () => {
    it('should use task type color, title, and energy when provided', () => {
      // Arrange
      const taskType: TaskTypeItem = {
        id: 'type-custom',
        name: 'Nauka',
        color: '#f59e0b',
        energy: 2,
      };
      const row: RawBlockWithRelations = {
        id: 'block-custom',
        starts_at: '2026-10-05T10:00:00.000Z',
        ends_at: '2026-10-05T11:00:00.000Z',
        status: 'planned',
        pinned: false,
        source: 'planner',
        task_id: 'task-nauka',
        tasks: {
          id: 'task-nauka',
          fixation: 'flexible',
          type_id: 'type-custom',
          task_types: taskType,
        },
      };

      // Act
      const event = mapBlockToCalendarEvent(row);

      // Assert
      expect(event.color).toBe('#f59e0b');
      expect(event.title).toBe('Nauka');
      expect(event.extendedProps.energy).toBe(2);
      expect(event.extendedProps.typeId).toBe('type-custom');
      expect(event.extendedProps.taskId).toBe('task-nauka');
      expect(event.extendedProps.kind).toBe('block');
    });

    it('should fallback to default task color, title, and energy when taskType is missing', () => {
      // Arrange
      const row: RawBlockWithRelations = {
        id: 'block-fallback',
        starts_at: '2026-10-05T10:00:00.000Z',
        ends_at: '2026-10-05T11:00:00.000Z',
        status: 'planned',
        pinned: false,
        source: 'manual',
        task_id: 'task-no-type',
        tasks: null,
      };

      // Act
      const event = mapBlockToCalendarEvent(row);

      // Assert
      expect(event.color).toBe('#3b82f6');
      expect(event.title).toBe('Zadanie');
      expect(event.extendedProps.energy).toBe(1);
      expect(event.extendedProps.typeId).toBeNull();
    });

    it('should use restType color and id when provided for rest block', () => {
      // Arrange
      const restType: TaskTypeItem = {
        id: 'type-rest-system',
        name: 'Odpoczynek',
        color: '#475569',
        energy: 0,
        is_rest: true,
      };
      const row: RawBlockWithRelations = {
        id: 'block-rest-custom',
        starts_at: '2026-10-05T12:00:00.000Z',
        ends_at: '2026-10-05T13:00:00.000Z',
        status: 'planned',
        pinned: true,
        source: 'rest',
        task_id: null,
      };

      // Act
      const event = mapBlockToCalendarEvent(row, restType);

      // Assert
      expect(event.color).toBe('#475569');
      expect(event.title).toBe('Odpoczynek');
      expect(event.extendedProps.typeId).toBe('type-rest-system');
      expect(event.extendedProps.pinned).toBe(true);
      expect(event.extendedProps.energy).toBe(0);
    });

    it('should fallback to default rest color when restType is missing', () => {
      // Arrange
      const row: RawBlockWithRelations = {
        id: 'block-rest-default',
        starts_at: '2026-10-05T12:00:00.000Z',
        ends_at: '2026-10-05T13:00:00.000Z',
        status: 'planned',
        pinned: false,
        source: 'rest',
        task_id: null,
      };

      // Act
      const event = mapBlockToCalendarEvent(row);

      // Assert
      expect(event.color).toBe('#6b7280');
      expect(event.extendedProps.typeId).toBeNull();
      expect(event.extendedProps.energy).toBe(0);
    });
  });

  describe('mapExternalToCalendarEvent', () => {
    it('should map external event with subscription and type', () => {
      // Arrange
      const row: RawExternalWithRelations = {
        id: 'ext-1',
        title: 'Wizyta u lekarza',
        starts_at: '2026-10-06T14:00:00.000Z',
        ends_at: '2026-10-06T15:00:00.000Z',
        calendar_subscriptions: {
          id: 'sub-1',
          type_id: 'type-ext',
          task_types: {
            id: 'type-ext',
            name: 'Wydarzenia zewnętrzne',
            color: '#8b5cf6',
            energy: 1,
          },
        },
      };

      // Act
      const event = mapExternalToCalendarEvent(row);

      // Assert
      expect(event.id).toBe('ext-1');
      expect(event.title).toBe('Wizyta u lekarza');
      expect(event.start).toBe('2026-10-06T14:00:00.000Z');
      expect(event.end).toBe('2026-10-06T15:00:00.000Z');
      expect(event.color).toBe('#8b5cf6');
      expect(event.editable).toBe(false);
      expect(event.extendedProps).toEqual({
        kind: 'external',
        status: null,
        pinned: false,
        taskId: null,
        energy: 1,
        typeId: 'type-ext',
      });
    });

    it('should fallback when subscription or type is missing', () => {
      // Arrange
      const row: RawExternalWithRelations = {
        id: 'ext-2',
        title: 'Spotkanie',
        starts_at: '2026-10-06T16:00:00.000Z',
        ends_at: '2026-10-06T17:00:00.000Z',
        calendar_subscriptions: null,
      };

      // Act
      const event = mapExternalToCalendarEvent(row);

      // Assert
      expect(event.color).toBe('#64748b');
      expect(event.extendedProps.energy).toBe(0);
      expect(event.extendedProps.typeId).toBeNull();
    });
  });

  describe('expandRecurringToCalendarEvents', () => {
    it('should preserve local wall-clock time across Warsaw DST change on 2026-10-25', () => {
      // Arrange:
      // In Europe/Warsaw, DST clock change occurs on 2026-10-25 (03:00 CEST -> 02:00 CET).
      // A weekly lesson on Tuesday (weekday = 2) at 08:00-08:45 wall-clock:
      // - 2026-10-20 (CEST, UTC+2) -> 06:00:00.000Z to 06:45:00.000Z
      // - 2026-10-27 (CET, UTC+1)  -> 07:00:00.000Z to 07:45:00.000Z
      const recurringItem: RawRecurringWithRelations = {
        id: 'rec-lesson-1',
        title: 'Matematyka',
        weekday: 2,
        start_time: '08:00:00',
        end_time: '08:45:00',
        valid_from: '2026-09-01',
        valid_until: '2027-06-30',
        type_id: 'type-school',
        task_types: {
          id: 'type-school',
          name: 'Szkoła',
          color: '#3b82f6',
          energy: 2,
        },
      };

      const range: CalendarRange = {
        start: '2026-10-19T00:00:00.000Z',
        end: '2026-10-31T00:00:00.000Z',
      };

      // Act
      const events = expandRecurringToCalendarEvents(recurringItem, range, 'Europe/Warsaw');

      // Assert
      expect(events).toHaveLength(2);

      const firstOccurrence = events[0];
      const secondOccurrence = events[1];
      if (!firstOccurrence || !secondOccurrence) {
        expect.fail('Expected 2 occurrences');
      }

      // Before DST change (CEST: UTC+2): 08:00 local is 06:00Z
      expect(firstOccurrence.start).toBe('2026-10-20T06:00:00.000Z');
      expect(firstOccurrence.end).toBe('2026-10-20T06:45:00.000Z');
      expect(firstOccurrence.id).toBe('rec-lesson-1-2026-10-20T06:00:00.000Z');
      expect(firstOccurrence.title).toBe('Matematyka');
      expect(firstOccurrence.color).toBe('#3b82f6');
      expect(firstOccurrence.editable).toBe(false);
      expect(firstOccurrence.extendedProps).toEqual({
        kind: 'recurring',
        status: null,
        pinned: false,
        taskId: null,
        energy: 2,
        typeId: 'type-school',
      });

      // After DST change (CET: UTC+1): 08:00 local is 07:00Z
      expect(secondOccurrence.start).toBe('2026-10-27T07:00:00.000Z');
      expect(secondOccurrence.end).toBe('2026-10-27T07:45:00.000Z');
      expect(secondOccurrence.id).toBe('rec-lesson-1-2026-10-27T07:00:00.000Z');
      expect(secondOccurrence.title).toBe('Matematyka');
    });

    it('should fallback to default task color and energy when task_types is missing', () => {
      // Arrange
      const recurringItem: RawRecurringWithRelations = {
        id: 'rec-no-type',
        title: 'Nawyk',
        weekday: 1,
        start_time: '10:00',
        end_time: '11:00',
        valid_from: '2026-10-01',
        valid_until: null,
        type_id: 'type-none',
        task_types: null,
      };

      const range: CalendarRange = {
        start: '2026-10-05T00:00:00.000Z',
        end: '2026-10-06T00:00:00.000Z',
      };

      // Act
      const events = expandRecurringToCalendarEvents(recurringItem, range, 'Europe/Warsaw');

      // Assert
      expect(events).toHaveLength(1);
      const firstEvent = events[0];
      if (!firstEvent) {
        expect.fail('Expected 1 event');
      }
      expect(firstEvent.color).toBe('#3b82f6');
      expect(firstEvent.extendedProps.energy).toBe(1);
      expect(firstEvent.extendedProps.typeId).toBe('type-none');
    });
  });
});
