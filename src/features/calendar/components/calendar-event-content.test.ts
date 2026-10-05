import { describe, expect, it } from 'vitest';

import {
  getEventVisualClasses,
  renderCalendarEventContent,
} from './calendar-event-content';

describe('calendar-event-content helpers and renderer', () => {
  describe('getEventVisualClasses', () => {
    it('should return line-through and opacity when status is done', () => {
      // Arrange & Act
      const result = getEventVisualClasses('done', 'block');

      // Assert
      expect(result).toBe('line-through opacity-75');
    });

    it('should return muted and line-through when status is missed', () => {
      // Arrange & Act
      const result = getEventVisualClasses('missed', 'block');

      // Assert
      expect(result).toBe('opacity-60 text-muted-foreground line-through');
    });

    it('should return border-primary styling when kind is recurring', () => {
      // Arrange & Act
      const result = getEventVisualClasses(null, 'recurring');

      // Assert
      expect(result).toBe('border-l-2 border-primary/60');
    });

    it('should return border-muted-foreground styling when kind is external', () => {
      // Arrange & Act
      const result = getEventVisualClasses(null, 'external');

      // Assert
      expect(result).toBe('border-l-2 border-muted-foreground/60 opacity-90');
    });

    it('should return empty string when status is planned and kind is block', () => {
      // Arrange & Act
      const result = getEventVisualClasses('planned', 'block');

      // Assert
      expect(result).toBe('');
    });

    it('should return empty string when status is null and kind is undefined', () => {
      // Arrange & Act
      const result = getEventVisualClasses(null, undefined);

      // Assert
      expect(result).toBe('');
    });
  });

  describe('renderCalendarEventContent', () => {
    it('should produce React element with pinned block props when event is pinned planned block', () => {
      // Arrange
      const mockInfo = {
        event: {
          title: 'Zadanie testowe',
          extendedProps: {
            kind: 'block',
            status: 'planned',
            pinned: true,
            energy: 2,
            taskId: 'task-1',
          },
        },
        timeText: '08:00 - 09:30',
      };

      // Act
      const element = renderCalendarEventContent(mockInfo);

      // Assert
      expect(element).toBeDefined();
      expect(element.props.title).toBe('Zadanie testowe');
      expect(element.props.timeText).toBe('08:00 - 09:30');
      expect(element.props.pinned).toBe(true);
      expect(element.props.status).toBe('planned');
      expect(element.props.kind).toBe('block');
    });

    it('should produce React element with completed status props when event is done', () => {
      // Arrange
      const mockInfo = {
        event: {
          title: 'Projekt biologia',
          extendedProps: {
            kind: 'block',
            status: 'done',
            pinned: false,
            energy: 3,
            taskId: 'task-2',
          },
        },
        timeText: '10:00 - 11:30',
      };

      // Act
      const element = renderCalendarEventContent(mockInfo);

      // Assert
      expect(element).toBeDefined();
      expect(element.props.title).toBe('Projekt biologia');
      expect(element.props.timeText).toBe('10:00 - 11:30');
      expect(element.props.pinned).toBe(false);
      expect(element.props.status).toBe('done');
      expect(element.props.kind).toBe('block');
    });

    it('should produce React element with recurring kind props when event is recurring', () => {
      // Arrange
      const mockInfo = {
        event: {
          title: 'Lekcja historii',
          extendedProps: {
            kind: 'recurring',
            status: null,
            pinned: false,
            energy: 1,
            taskId: null,
          },
        },
        timeText: '12:00 - 13:30',
      };

      // Act
      const element = renderCalendarEventContent(mockInfo);

      // Assert
      expect(element).toBeDefined();
      expect(element.props.title).toBe('Lekcja historii');
      expect(element.props.timeText).toBe('12:00 - 13:30');
      expect(element.props.pinned).toBe(false);
      expect(element.props.status).toBeNull();
      expect(element.props.kind).toBe('recurring');
    });
  });
});
