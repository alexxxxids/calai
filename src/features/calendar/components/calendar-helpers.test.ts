import { describe, expect, it } from 'vitest';

import {
  calculateDropStartIso,
  extractBlockFromEvent,
  formatEventTimeRange,
  getEventStatusBadge,
  parseBlockStatus,
  parseDurationToMinutes,
  resolveDropInstants,
} from './calendar-helpers';

describe('calendar-helpers', () => {
  describe('parseDurationToMinutes', () => {
    it('should parse standard HH:MM duration string to minutes when valid', () => {
      // Arrange
      const durationStr = '01:30';

      // Act
      const result = parseDurationToMinutes(durationStr);

      // Assert
      expect(result).toBe(90);
    });

    it('should parse duration under one hour when valid', () => {
      // Arrange
      const durationStr = '00:45';

      // Act
      const result = parseDurationToMinutes(durationStr);

      // Assert
      expect(result).toBe(45);
    });

    it('should parse multi-hour duration when valid', () => {
      // Arrange
      const durationStr = '02:00';

      // Act
      const result = parseDurationToMinutes(durationStr);

      // Assert
      expect(result).toBe(120);
    });

    it('should parse single-digit hour duration when valid', () => {
      // Arrange
      const durationStr = '1:15';

      // Act
      const result = parseDurationToMinutes(durationStr);

      // Assert
      expect(result).toBe(75);
    });

    it('should fallback to default drop duration when duration is null', () => {
      // Arrange
      const durationStr = null;

      // Act
      const result = parseDurationToMinutes(durationStr);

      // Assert
      expect(result).toBe(90);
    });

    it('should fallback to default drop duration when duration is undefined', () => {
      // Arrange
      const durationStr = undefined;

      // Act
      const result = parseDurationToMinutes(durationStr);

      // Assert
      expect(result).toBe(90);
    });

    it('should fallback to default drop duration when duration is empty string', () => {
      // Arrange
      const durationStr = '';

      // Act
      const result = parseDurationToMinutes(durationStr);

      // Assert
      expect(result).toBe(90);
    });

    it('should fallback to default drop duration when string is invalid format', () => {
      // Arrange
      const durationStr = 'invalid';

      // Act
      const result = parseDurationToMinutes(durationStr);

      // Assert
      expect(result).toBe(90);
    });

    it('should fallback to default drop duration when duration is zero', () => {
      // Arrange
      const durationStr = '00:00';

      // Act
      const result = parseDurationToMinutes(durationStr);

      // Assert
      expect(result).toBe(90);
    });

    it('should fallback to default drop duration when minutes are 60 or more', () => {
      // Arrange
      const durationStr = '01:60';

      // Act
      const result = parseDurationToMinutes(durationStr);

      // Assert
      expect(result).toBe(90);
    });
  });

  describe('calculateDropStartIso', () => {
    it('should preserve exact date instant when allDay is false', () => {
      // Arrange
      const date = new Date('2026-10-05T10:15:00.000Z');
      const allDay = false;
      const workStart = '08:00';
      const timeZone = 'Europe/Warsaw';

      // Act
      const result = calculateDropStartIso(date, allDay, workStart, timeZone);

      // Assert
      expect(result).toBe('2026-10-05T10:15:00.000Z');
    });

    it('should place start at workStart in target timeZone during summer time when allDay is true', () => {
      // Arrange: 08:00 Warsaw summer time (UTC+2) is 06:00 UTC
      const date = new Date('2026-10-05T00:00:00.000Z');
      const allDay = true;
      const workStart = '08:00';
      const timeZone = 'Europe/Warsaw';

      // Act
      const result = calculateDropStartIso(date, allDay, workStart, timeZone);

      // Assert
      expect(result).toBe('2026-10-05T06:00:00.000Z');
    });

    it('should place start at workStart in target timeZone during winter time when allDay is true', () => {
      // Arrange: 08:00 Warsaw winter time (UTC+1) is 07:00 UTC
      const date = new Date('2026-11-03T00:00:00.000Z');
      const allDay = true;
      const workStart = '08:00';
      const timeZone = 'Europe/Warsaw';

      // Act
      const result = calculateDropStartIso(date, allDay, workStart, timeZone);

      // Assert
      expect(result).toBe('2026-11-03T07:00:00.000Z');
    });

    it('should respect custom workStart when provided', () => {
      // Arrange: 09:30 Warsaw summer time (UTC+2) is 07:30 UTC
      const date = new Date('2026-10-05T00:00:00.000Z');
      const allDay = true;
      const workStart = '09:30';
      const timeZone = 'Europe/Warsaw';

      // Act
      const result = calculateDropStartIso(date, allDay, workStart, timeZone);

      // Assert
      expect(result).toBe('2026-10-05T07:30:00.000Z');
    });

    it('should fallback to default workStart 08:00 when workStart is invalid', () => {
      // Arrange
      const date = new Date('2026-10-05T00:00:00.000Z');
      const allDay = true;
      const workStart = 'invalid';
      const timeZone = 'Europe/Warsaw';

      // Act
      const result = calculateDropStartIso(date, allDay, workStart, timeZone);

      // Assert
      expect(result).toBe('2026-10-05T06:00:00.000Z');
    });

    it('should place start at workStart in UTC when timeZone is UTC and allDay is true', () => {
      // Arrange
      const date = new Date('2026-10-05T00:00:00.000Z');
      const allDay = true;
      const workStart = '08:00';
      const timeZone = 'UTC';

      // Act
      const result = calculateDropStartIso(date, allDay, workStart, timeZone);

      // Assert
      expect(result).toBe('2026-10-05T08:00:00.000Z');
    });
  });

  describe('formatEventTimeRange', () => {
    it('should format both start and end times in user timezone when both exist', () => {
      // Arrange: 06:00 UTC is 08:00 Warsaw, 07:30 UTC is 09:30 Warsaw
      const start = new Date('2026-10-05T06:00:00.000Z');
      const end = new Date('2026-10-05T07:30:00.000Z');
      const timeZone = 'Europe/Warsaw';

      // Act
      const result = formatEventTimeRange(start, end, timeZone);

      // Assert
      expect(result).toBe('08:00 – 09:30');
    });

    it('should format only start time when end is null', () => {
      // Arrange
      const start = new Date('2026-10-05T06:00:00.000Z');
      const end = null;
      const timeZone = 'Europe/Warsaw';

      // Act
      const result = formatEventTimeRange(start, end, timeZone);

      // Assert
      expect(result).toBe('08:00');
    });

    it('should format only end time when start is null', () => {
      // Arrange
      const start = null;
      const end = new Date('2026-10-05T07:30:00.000Z');
      const timeZone = 'Europe/Warsaw';

      // Act
      const result = formatEventTimeRange(start, end, timeZone);

      // Assert
      expect(result).toBe('09:30');
    });

    it('should return empty string when both start and end are null', () => {
      // Arrange
      const start = null;
      const end = null;
      const timeZone = 'Europe/Warsaw';

      // Act
      const result = formatEventTimeRange(start, end, timeZone);

      // Assert
      expect(result).toBe('');
    });

    it('should return empty string when dates are invalid', () => {
      // Arrange
      const start = new Date('invalid');
      const end = new Date('invalid');
      const timeZone = 'Europe/Warsaw';

      // Act
      const result = formatEventTimeRange(start, end, timeZone);

      // Assert
      expect(result).toBe('');
    });

    it('should format differently in UTC versus Warsaw timezone', () => {
      // Arrange
      const start = new Date('2026-10-05T06:00:00.000Z');
      const end = new Date('2026-10-05T07:30:00.000Z');
      const timeZone = 'UTC';

      // Act
      const result = formatEventTimeRange(start, end, timeZone);

      // Assert
      expect(result).toBe('06:00 – 07:30');
    });
  });

  describe('getEventStatusBadge', () => {
    it('should return Zaplanowany with outline variant when status is planned', () => {
      // Arrange
      const status = 'planned';

      // Act
      const badge = getEventStatusBadge(status);

      // Assert
      expect(badge.text).toBe('Zaplanowany');
      expect(badge.variant).toBe('outline');
    });

    it('should return Wykonano with default variant when status is done', () => {
      // Arrange
      const status = 'done';

      // Act
      const badge = getEventStatusBadge(status);

      // Assert
      expect(badge.text).toBe('Wykonano');
      expect(badge.variant).toBe('default');
    });

    it('should return Pominięto with destructive variant when status is missed', () => {
      // Arrange
      const status = 'missed';

      // Act
      const badge = getEventStatusBadge(status);

      // Assert
      expect(badge.text).toBe('Pominięto');
      expect(badge.variant).toBe('destructive');
    });

    it('should fallback to Zaplanowany when status is null', () => {
      // Arrange
      const status = null;

      // Act
      const badge = getEventStatusBadge(status);

      // Assert
      expect(badge.text).toBe('Zaplanowany');
      expect(badge.variant).toBe('outline');
    });

    it('should fallback to Zaplanowany when status is undefined', () => {
      // Arrange
      const status = undefined;

      // Act
      const badge = getEventStatusBadge(status);

      // Assert
      expect(badge.text).toBe('Zaplanowany');
      expect(badge.variant).toBe('outline');
    });

    it('should fallback to Zaplanowany when status is unknown string', () => {
      // Arrange
      const status = 'unknown';

      // Act
      const badge = getEventStatusBadge(status);

      // Assert
      expect(badge.text).toBe('Zaplanowany');
      expect(badge.variant).toBe('outline');
    });
  });

  describe('parseBlockStatus', () => {
    it('should return planned when raw status is planned', () => {
      // Arrange & Act
      const result = parseBlockStatus('planned');

      // Assert
      expect(result).toBe('planned');
    });

    it('should return done when raw status is done', () => {
      // Arrange & Act
      const result = parseBlockStatus('done');

      // Assert
      expect(result).toBe('done');
    });

    it('should return missed when raw status is missed', () => {
      // Arrange & Act
      const result = parseBlockStatus('missed');

      // Assert
      expect(result).toBe('missed');
    });

    it('should return null when raw status is invalid string or null', () => {
      // Arrange & Act & Assert
      expect(parseBlockStatus('invalid')).toBeNull();
      expect(parseBlockStatus(null)).toBeNull();
      expect(parseBlockStatus(undefined)).toBeNull();
      expect(parseBlockStatus(123)).toBeNull();
    });
  });

  describe('extractBlockFromEvent', () => {
    it('should return null when event kind is not block', () => {
      // Arrange
      const event = {
        id: 'event-1',
        title: 'Spotkanie',
        start: new Date('2026-10-05T08:00:00Z'),
        end: new Date('2026-10-05T09:00:00Z'),
        startStr: '2026-10-05T08:00:00Z',
        endStr: '2026-10-05T09:00:00Z',
        extendedProps: { kind: 'external' },
      };

      // Act
      const result = extractBlockFromEvent(event);

      // Assert
      expect(result).toBeNull();
    });

    it('should return CalendarEventItem with extracted properties when event kind is block', () => {
      // Arrange
      const event = {
        id: 'block-1',
        title: 'Programowanie',
        start: new Date('2026-10-05T10:00:00Z'),
        end: new Date('2026-10-05T11:30:00Z'),
        startStr: '2026-10-05T10:00:00Z',
        endStr: '2026-10-05T11:30:00Z',
        color: '#3b82f6',
        startEditable: true,
        extendedProps: {
          kind: 'block',
          status: 'planned',
          pinned: true,
          taskId: 'task-123',
          energy: 2,
          typeId: 'type-456',
        },
      };

      // Act
      const result = extractBlockFromEvent(event);

      // Assert
      expect(result).toEqual({
        id: 'block-1',
        title: 'Programowanie',
        start: '2026-10-05T10:00:00.000Z',
        end: '2026-10-05T11:30:00.000Z',
        color: '#3b82f6',
        editable: true,
        extendedProps: {
          kind: 'block',
          status: 'planned',
          pinned: true,
          taskId: 'task-123',
          energy: 2,
          typeId: 'type-456',
        },
      });
    });

    it('should fallback to string dates and default energy when Date instances are null and energy missing', () => {
      // Arrange
      const event = {
        id: 'block-2',
        title: 'Historia',
        start: null,
        end: null,
        startStr: '2026-10-05T12:00:00Z',
        endStr: '2026-10-05T13:00:00Z',
        extendedProps: {
          kind: 'block',
          status: 'done',
          pinned: false,
        },
      };

      // Act
      const result = extractBlockFromEvent(event);

      // Assert
      expect(result).toEqual({
        id: 'block-2',
        title: 'Historia',
        start: '2026-10-05T12:00:00Z',
        end: '2026-10-05T13:00:00Z',
        color: '',
        editable: true,
        extendedProps: {
          kind: 'block',
          status: 'done',
          pinned: false,
          taskId: null,
          energy: 1,
          typeId: null,
        },
      });
    });
  });

  describe('resolveDropInstants', () => {
    it('should preserve eventEnd when not allDay and eventEnd is provided', () => {
      // Arrange
      const params = {
        eventStart: new Date('2026-10-05T08:00:00Z'),
        eventEnd: new Date('2026-10-05T09:30:00Z'),
        eventStartStr: '2026-10-05T08:00:00Z',
        allDay: false,
        oldStart: new Date('2026-10-05T07:00:00Z'),
        oldEnd: new Date('2026-10-05T08:00:00Z'),
        workStart: '08:00',
        timeZone: 'Europe/Warsaw',
      };

      // Act
      const result = resolveDropInstants(params);

      // Assert
      expect(result.start).toBe('2026-10-05T08:00:00.000Z');
      expect(result.end).toBe('2026-10-05T09:30:00.000Z');
    });

    it('should calculate start at workStart and preserve old duration when allDay is true', () => {
      // Arrange: Warsaw summer time UTC+2, 08:00 local is 06:00 UTC
      const params = {
        eventStart: new Date('2026-10-06T00:00:00Z'),
        eventEnd: null,
        eventStartStr: '2026-10-06',
        allDay: true,
        oldStart: new Date('2026-10-05T10:00:00Z'),
        oldEnd: new Date('2026-10-05T11:00:00Z'),
        workStart: '08:00',
        timeZone: 'Europe/Warsaw',
      };

      // Act
      const result = resolveDropInstants(params);

      // Assert: start at 06:00 UTC, end at 07:00 UTC (60 mins later)
      expect(result.start).toBe('2026-10-06T06:00:00.000Z');
      expect(result.end).toBe('2026-10-06T07:00:00.000Z');
    });
  });

});
