import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/features/blocks/actions', () => ({
  closeBlock: vi.fn(),
}));

vi.mock('@/features/recurring-events/actions', () => ({
  createRecurringEvents: vi.fn(),
  deleteRecurringEvent: vi.fn(),
}));

vi.mock('@/features/recurring-events/components/recurring-events-dialog', () => ({
  RecurringEventsDialog: ({
    open,
    taskTypes,
    events,
    timeZone,
  }: {
    open: boolean;
    taskTypes: readonly unknown[];
    events?: readonly unknown[];
    timeZone?: string;
  }) =>
    React.createElement('div', {
      'data-testid': 'mock-recurring-dialog',
      'data-open': String(open),
      'data-task-types-count': String(taskTypes.length),
      'data-events-count': String(events?.length ?? 0),
      'data-timezone': timeZone ?? '',
    }),
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { UnclosedBlockItem } from '@/features/blocks/types';
import type { RecurringEventWithRelations } from '@/features/recurring-events/types';
import {
  CalendarHabitsSection,
  CalendarLessonPlanButton,
  CalendarMiniNav,
  CalendarSidebar,
  CalendarSidebarView,
  CalendarTypeFilter,
  CalendarTypeItemRow,
  countActiveTaskTypes,
  DAY_VIEW_NAME,
  isDayView,
  type CalendarSidebarProps,
  type CalendarSidebarViewProps,
  type TaskTypeSidebarItem,
} from './calendar-sidebar';

function createMockTaskTypes(): readonly TaskTypeSidebarItem[] {
  return [
    { id: 'type-1', name: 'Matematyka', color: '#3b82f6', energy: 3 },
    { id: 'type-2', name: 'Historia', color: '#ef4444', energy: 2 },
    { id: 'type-3', name: 'Informatyka', color: '#10b981', energy: 1 },
  ];
}

function createMockUnclosedBlock(
  overrides: Partial<UnclosedBlockItem> = {},
): UnclosedBlockItem {
  return {
    id: 'block-test-1',
    taskId: 'task-test-1',
    startsAt: '2026-10-11T08:00:00.000Z',
    endsAt: '2026-10-11T09:30:00.000Z',
    workMinutes: 90,
    typeName: 'Matematyka',
    typeColor: '#3b82f6',
    typeEnergy: 3,
    notes: 'Zadania ze strony 42',
    ...overrides,
  };
}

function createMockRecurringEvent(
  overrides: Partial<RecurringEventWithRelations> = {},
): RecurringEventWithRelations {
  return {
    id: 'rec-1',
    title: 'Fizyka',
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

describe('calendar-sidebar components and logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isDayView helper', () => {
    it('should return true when currentView is timeGridDay', () => {
      // Act & Assert
      expect(isDayView(DAY_VIEW_NAME)).toBe(true);
      expect(isDayView('timeGridDay')).toBe(true);
    });

    it('should return false when currentView is timeGridWeek', () => {
      // Act & Assert
      expect(isDayView('timeGridWeek')).toBe(false);
    });

    it('should return false when currentView is dayGridMonth', () => {
      // Act & Assert
      expect(isDayView('dayGridMonth')).toBe(false);
    });

    it('should return false when currentView is empty or unknown', () => {
      // Act & Assert
      expect(isDayView('')).toBe(false);
      expect(isDayView('customView')).toBe(false);
    });
  });

  describe('countActiveTaskTypes helper', () => {
    it('should return total count when hiddenTypeIds is undefined', () => {
      // Arrange
      const types = createMockTaskTypes();

      // Act
      const result = countActiveTaskTypes(types, undefined);

      // Assert
      expect(result).toBe(3);
    });

    it('should return total count when hiddenTypeIds set is empty', () => {
      // Arrange
      const types = createMockTaskTypes();
      const hidden = new Set<string>();

      // Act
      const result = countActiveTaskTypes(types, hidden);

      // Assert
      expect(result).toBe(3);
    });

    it('should return 2 when 1 of 3 types is hidden', () => {
      // Arrange
      const types = createMockTaskTypes();
      const hidden = new Set<string>(['type-2']);

      // Act
      const result = countActiveTaskTypes(types, hidden);

      // Assert
      expect(result).toBe(2);
    });

    it('should return 0 when all types are hidden', () => {
      // Arrange
      const types = createMockTaskTypes();
      const hidden = new Set<string>(['type-1', 'type-2', 'type-3']);

      // Act
      const result = countActiveTaskTypes(types, hidden);

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0 when taskTypes array is empty', () => {
      // Act & Assert
      expect(countActiveTaskTypes([], new Set<string>(['type-1']))).toBe(0);
    });
  });

  describe('CalendarSidebar rendering and markup', () => {
    it('should render mini-calendar, type filters, active count, and lesson plan button', () => {
      // Arrange
      const taskTypes = createMockTaskTypes();
      const selectedDate = new Date('2026-10-11T12:00:00.000Z');
      const onDateSelect = vi.fn();

      const props: CalendarSidebarProps = {
        taskTypes,
        selectedDate,
        onDateSelect,
        currentView: 'timeGridWeek',
        selectedDayStr: '2026-10-11',
      };

      // Act
      const html = renderToStaticMarkup(React.createElement(CalendarSidebar, props));

      // Assert
      expect(html).toContain('Boczny panel kalendarza');
      expect(html).toContain('Plan lekcji');
      expect(html).toContain('Filtruj zadania');
      expect(html).toContain('3/3');
      expect(html).toContain('Matematyka');
      expect(html).toContain('Historia');
      expect(html).toContain('Informatyka');
      expect(html).toContain('background-color:#3b82f6');
      expect(html).toContain('background-color:#ef4444');
      expect(html).toContain('background-color:#10b981');
      expect(html).toContain('data-testid="mock-recurring-dialog"');
      expect(html).toContain('data-open="false"');
    });

    it('should render empty message when taskTypes is empty', () => {
      // Arrange
      const props: CalendarSidebarProps = {
        taskTypes: [],
        selectedDate: new Date('2026-10-11T12:00:00.000Z'),
        onDateSelect: vi.fn(),
        currentView: 'timeGridWeek',
        selectedDayStr: '2026-10-11',
      };

      // Act
      const html = renderToStaticMarkup(React.createElement(CalendarSidebar, props));

      // Assert
      expect(html).toContain('0/0');
      expect(html).toContain('Brak typów zadań');
    });

    it('should render CloseDayBanner at top when unclosedBlocks are provided', () => {
      // Arrange
      const blocks = [createMockUnclosedBlock()];
      const props: CalendarSidebarProps = {
        taskTypes: createMockTaskTypes(),
        selectedDate: new Date('2026-10-11T12:00:00.000Z'),
        onDateSelect: vi.fn(),
        currentView: 'timeGridWeek',
        selectedDayStr: '2026-10-11',
        unclosedBlocks: blocks,
        timeZone: 'Europe/Warsaw',
      };

      // Act
      const html = renderToStaticMarkup(React.createElement(CalendarSidebar, props));

      // Assert
      expect(html).toContain('Niezamknięte bloki (1)');
      expect(html).toContain('Zadania ze strony 42');
    });

    it('should not render CloseDayBanner when unclosedBlocks is empty or omitted', () => {
      // Arrange
      const props: CalendarSidebarProps = {
        taskTypes: createMockTaskTypes(),
        selectedDate: new Date('2026-10-11T12:00:00.000Z'),
        onDateSelect: vi.fn(),
        currentView: 'timeGridWeek',
        selectedDayStr: '2026-10-11',
        unclosedBlocks: [],
      };

      // Act
      const html = renderToStaticMarkup(React.createElement(CalendarSidebar, props));

      // Assert
      expect(html).not.toContain('Niezamknięte bloki');
    });
  });

  describe('HabitChecklist visibility rule (currentView === timeGridDay)', () => {
    it('should render Nawyki na dzień section when currentView is timeGridDay', () => {
      // Arrange
      const props: CalendarSidebarProps = {
        taskTypes: createMockTaskTypes(),
        selectedDate: new Date('2026-10-11T12:00:00.000Z'),
        onDateSelect: vi.fn(),
        currentView: 'timeGridDay',
        selectedDayStr: '2026-10-11',
      };

      // Act
      const html = renderToStaticMarkup(React.createElement(CalendarSidebar, props));

      // Assert
      expect(html).toContain('Nawyki na dzień');
    });

    it('should NOT render Nawyki na dzień section when currentView is timeGridWeek', () => {
      // Arrange
      const props: CalendarSidebarProps = {
        taskTypes: createMockTaskTypes(),
        selectedDate: new Date('2026-10-11T12:00:00.000Z'),
        onDateSelect: vi.fn(),
        currentView: 'timeGridWeek',
        selectedDayStr: '2026-10-11',
      };

      // Act
      const html = renderToStaticMarkup(React.createElement(CalendarSidebar, props));

      // Assert
      expect(html).not.toContain('Nawyki na dzień');
    });

    it('should NOT render Nawyki na dzień section when currentView is dayGridMonth', () => {
      // Arrange
      const props: CalendarSidebarProps = {
        taskTypes: createMockTaskTypes(),
        selectedDate: new Date('2026-10-11T12:00:00.000Z'),
        onDateSelect: vi.fn(),
        currentView: 'dayGridMonth',
        selectedDayStr: '2026-10-11',
      };

      // Act
      const html = renderToStaticMarkup(React.createElement(CalendarSidebar, props));

      // Assert
      expect(html).not.toContain('Nawyki na dzień');
    });

    it('should render CalendarHabitsSection with Polish title and day prop', () => {
      // Act
      const html = renderToStaticMarkup(
        React.createElement(CalendarHabitsSection, { selectedDayStr: '2026-10-11' }),
      );

      // Assert
      expect(html).toContain('Nawyki na dzień');
    });
  });

  describe('onToggleTypeVisibility filter switching', () => {
    it('should call onToggle with type.id when CalendarTypeItemRow triggers checkbox change', () => {
      // Arrange
      const onToggle = vi.fn();
      const type: TaskTypeSidebarItem = {
        id: 'type-test-abc',
        name: 'Biologia',
        color: '#22c55e',
      };

      // Act
      const rowElement = CalendarTypeItemRow({
        type,
        checked: true,
        onToggle,
      });

      // Assert & trigger
      expect(rowElement.props.children).toBeDefined();
      const checkboxElement = rowElement.props.children[0];
      checkboxElement.props.onCheckedChange();

      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith('type-test-abc');
    });

    it('should trigger onToggleTypeVisibility when CalendarTypeFilter row is toggled', () => {
      // Arrange
      const onToggleTypeVisibility = vi.fn();
      const taskTypes = createMockTaskTypes();
      const hiddenTypeIds = new Set<string>(['type-1']);

      // Act
      const filterElement = CalendarTypeFilter({
        taskTypes,
        hiddenTypeIds,
        onToggleTypeVisibility,
      });

      // Filter children: [header, rowsContainer]
      const rowsContainer = filterElement.props.children[1];
      const rows = rowsContainer.props.children;
      expect(rows).toHaveLength(3);

      // Trigger second row toggle ('type-2')
      rows[1].props.onToggle('type-2');

      // Assert
      expect(onToggleTypeVisibility).toHaveBeenCalledWith('type-2');
    });

    it('should render active count 2/3 when one type is hidden', () => {
      // Arrange
      const taskTypes = createMockTaskTypes();
      const hiddenTypeIds = new Set<string>(['type-1']);
      const props: CalendarSidebarProps = {
        taskTypes,
        selectedDate: new Date('2026-10-11T12:00:00.000Z'),
        onDateSelect: vi.fn(),
        currentView: 'timeGridWeek',
        selectedDayStr: '2026-10-11',
        hiddenTypeIds,
      };

      // Act
      const html = renderToStaticMarkup(React.createElement(CalendarSidebar, props));

      // Assert
      expect(html).toContain('2/3');
    });
  });

  describe('onDateSelect date selection handling', () => {
    it('should call onDateSelect when Calendar onSelect provides a valid Date', () => {
      // Arrange
      const onDateSelect = vi.fn();
      const selectedDate = new Date('2026-10-11T12:00:00.000Z');

      // Act
      const navElement = CalendarMiniNav({ selectedDate, onDateSelect });
      const calendarElement = navElement.props.children;

      const newDate = new Date('2026-10-15T10:00:00.000Z');
      calendarElement.props.onSelect(newDate);

      // Assert
      expect(onDateSelect).toHaveBeenCalledTimes(1);
      expect(onDateSelect).toHaveBeenCalledWith(newDate);
    });

    it('should NOT call onDateSelect when Calendar onSelect provides undefined', () => {
      // Arrange
      const onDateSelect = vi.fn();
      const selectedDate = new Date('2026-10-11T12:00:00.000Z');

      // Act
      const navElement = CalendarMiniNav({ selectedDate, onDateSelect });
      const calendarElement = navElement.props.children;
      calendarElement.props.onSelect(undefined);

      // Assert
      expect(onDateSelect).not.toHaveBeenCalled();
    });
  });

  describe('Lesson plan dialog opening and props wiring', () => {
    it('should trigger onClick when CalendarLessonPlanButton is clicked', () => {
      // Arrange
      const onClick = vi.fn();

      // Act
      const buttonElement = CalendarLessonPlanButton({ onClick });
      buttonElement.props.onClick();

      // Assert
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should pass open=true and event counts to dialog when recurringDialogOpen is true', () => {
      // Arrange
      const taskTypes = createMockTaskTypes();
      const recurringEvents = [createMockRecurringEvent()];
      const onRecurringEventsChanged = vi.fn();
      const onRecurringDialogOpenChange = vi.fn();

      const props: CalendarSidebarProps = {
        taskTypes,
        selectedDate: new Date('2026-10-11T12:00:00.000Z'),
        onDateSelect: vi.fn(),
        currentView: 'timeGridWeek',
        selectedDayStr: '2026-10-11',
        recurringEvents,
        onRecurringEventsChanged,
        recurringDialogOpen: true,
        onRecurringDialogOpenChange,
      };

      // Act
      const html = renderToStaticMarkup(React.createElement(CalendarSidebar, props));

      // Assert
      expect(html).toContain('data-testid="mock-recurring-dialog"');
      expect(html).toContain('data-open="true"');
      expect(html).toContain('data-events-count="1"');
      expect(html).toContain('data-task-types-count="3"');
    });

    it('should call onDialogOpenChange with true when lesson plan button is clicked in CalendarSidebarView', () => {
      // Arrange
      const onDialogOpenChange = vi.fn();
      const props: CalendarSidebarViewProps = {
        taskTypes: createMockTaskTypes(),
        selectedDate: new Date('2026-10-11T12:00:00.000Z'),
        onDateSelect: vi.fn(),
        currentView: 'timeGridWeek',
        selectedDayStr: '2026-10-11',
        isDialogOpen: false,
        onDialogOpenChange,
      };

      // Act
      const sidebarElement = CalendarSidebarView(props);
      // Children: [banner, miniNav, lessonPlanButton, typeFilter, habits, dialog]
      const buttonChild = sidebarElement.props.children[2];
      buttonChild.props.onClick();

      // Assert
      expect(onDialogOpenChange).toHaveBeenCalledWith(true);
    });

    it('should wire events and callback props to dialog in CalendarSidebarView', () => {
      // Arrange
      const taskTypes = createMockTaskTypes();
      const recurringEvents = [createMockRecurringEvent()];
      const onEventsChanged = vi.fn();
      const onDialogOpenChange = vi.fn();

      const props: CalendarSidebarViewProps = {
        taskTypes,
        selectedDate: new Date('2026-10-11T12:00:00.000Z'),
        onDateSelect: vi.fn(),
        currentView: 'timeGridWeek',
        selectedDayStr: '2026-10-11',
        recurringEvents,
        onRecurringEventsChanged: onEventsChanged,
        timeZone: 'Europe/Warsaw',
        isDialogOpen: true,
        onDialogOpenChange,
      };

      // Act
      const sidebarElement = CalendarSidebarView(props);
      // Children: [banner, miniNav, lessonPlanButton, typeFilter, habits, dialog]
      const dialogChild = sidebarElement.props.children[5];

      // Assert
      expect(dialogChild.props.open).toBe(true);
      expect(dialogChild.props.onOpenChange).toBe(onDialogOpenChange);
      expect(dialogChild.props.taskTypes).toEqual(taskTypes);
      expect(dialogChild.props.events).toEqual(recurringEvents);
      expect(dialogChild.props.onEventsChanged).toBe(onEventsChanged);
      expect(dialogChild.props.timeZone).toBe('Europe/Warsaw');
    });
  });
});
