import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mockRouterRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/features/recurring-events/components/recurring-events-dialog', () => ({
  RecurringEventsDialog: ({
    open,
    taskTypes,
  }: {
    open: boolean;
    taskTypes: readonly unknown[];
  }) =>
    React.createElement('div', {
      'data-testid': 'mock-recurring-dialog',
      'data-open': String(open),
      'data-task-types-count': String(taskTypes.length),
    }),
}));

vi.mock('@fullcalendar/react', () => ({
  default: function MockFullCalendar(props: { readonly initialView?: string }) {
    return React.createElement('div', {
      'data-testid': 'mock-full-calendar',
      'data-view': props.initialView ?? 'timeGridWeek',
    });
  },
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { UnclosedBlockItem } from '@/features/blocks/types';
import type { TaskTypeRow } from '@/features/task-types';
import type { BacklogTaskItem } from '@/features/tasks/types';

import {
  CalendarPageContent,
  mapTaskTypesToSidebarItems,
  resolveCalendarDateChange,
} from './calendar-page-content';

function createMockTaskTypes(): readonly TaskTypeRow[] {
  return [
    {
      id: 'type-1',
      user_id: 'user-1',
      name: 'Matematyka',
      color: '#3b82f6',
      energy: 3,
      is_rest: false,
      is_one_off: false,
      archived_at: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
    },
    {
      id: 'type-2',
      user_id: 'user-1',
      name: 'Historia',
      color: '#ef4444',
      energy: 2,
      is_rest: false,
      is_one_off: false,
      archived_at: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
    },
  ];
}

function createMockBacklogTasks(): readonly BacklogTaskItem[] {
  return [
    {
      id: 'task-1',
      typeId: 'type-1',
      typeName: 'Matematyka',
      typeColor: '#3b82f6',
      typeEnergy: 3,
      isOneOff: false,
      priority: 1,
      fixation: 'flexible',
      notes: 'Zadania ze strony 42',
      estimateMinutes: 90,
      sessionMinutes: 45,
      deadline: '2026-10-15T12:00:00.000Z',
      createdAt: '2026-10-02T10:00:00.000Z',
      typePace: 1.0,
    },
    {
      id: 'task-2',
      typeId: 'type-2',
      typeName: 'Historia',
      typeColor: '#ef4444',
      typeEnergy: 2,
      isOneOff: false,
      priority: 2,
      fixation: 'flexible',
      notes: 'Powtórka do sprawdzianu',
      estimateMinutes: 60,
      sessionMinutes: 60,
      deadline: null,
      createdAt: '2026-10-02T11:00:00.000Z',
      typePace: 1.1,
    },
  ];
}

function createMockUnclosedBlocks(): readonly UnclosedBlockItem[] {
  return [
    {
      id: 'block-1',
      taskId: 'task-1',
      startsAt: '2026-10-11T08:00:00.000Z',
      endsAt: '2026-10-11T09:30:00.000Z',
      workMinutes: 90,
      typeName: 'Matematyka',
      typeColor: '#3b82f6',
      typeEnergy: 3,
      notes: 'Algebra',
    },
  ];
}

describe('CalendarPageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mapTaskTypesToSidebarItems', () => {
    it('should map TaskTypeRow array to TaskTypeSidebarItem array preserving id, name, color, energy', () => {
      const taskTypes = createMockTaskTypes();
      const sidebarItems = mapTaskTypesToSidebarItems(taskTypes);

      expect(sidebarItems).toEqual([
        { id: 'type-1', name: 'Matematyka', color: '#3b82f6', energy: 3 },
        { id: 'type-2', name: 'Historia', color: '#ef4444', energy: 2 },
      ]);
    });

    it('should filter out one-off task types (is_one_off: true) according to FR-21', () => {
      const taskTypes: readonly TaskTypeRow[] = [
        ...createMockTaskTypes(),
        {
          id: 'type-one-off',
          user_id: 'user-1',
          name: 'Wizyta u lekarza',
          color: '#10b981',
          energy: 1,
          is_rest: false,
          is_one_off: true,
          archived_at: null,
          created_at: '2026-10-01T08:00:00.000Z',
          updated_at: '2026-10-01T08:00:00.000Z',
        },
      ];
      const sidebarItems = mapTaskTypesToSidebarItems(taskTypes);
      expect(sidebarItems).toEqual([
        { id: 'type-1', name: 'Matematyka', color: '#3b82f6', energy: 3 },
        { id: 'type-2', name: 'Historia', color: '#ef4444', energy: 2 },
      ]);
      expect(sidebarItems.some((item) => item.id === 'type-one-off')).toBe(false);
    });

    it('should handle empty array', () => {
      expect(mapTaskTypesToSidebarItems([])).toEqual([]);
    });
  });

  describe('Rendering Backlog scenarios', () => {
    it('should render empty state message and 0 count badge when backlog tasks array is empty', () => {
      const html = renderToStaticMarkup(
        React.createElement(CalendarPageContent, {
          tasks: [],
          taskTypes: createMockTaskTypes(),
          unclosedBlocks: [],
          timeZone: 'Europe/Warsaw',
          workStart: '08:00',
        }),
      );

      // Desktop backlog empty state
      expect(html).toContain('Brak zadań w skrzynce. Wszystko zaplanowane!');
      // Counter in desktop header and mobile trigger
      expect(html).toContain('0');
      // Mobile action bar button
      expect(html).toContain('Do zaplanowania: 0 zadań');
    });

    it('should render task items and accurate count when backlog tasks exist', () => {
      const tasks = createMockBacklogTasks();
      const html = renderToStaticMarkup(
        React.createElement(CalendarPageContent, {
          tasks,
          taskTypes: createMockTaskTypes(),
          unclosedBlocks: [],
          timeZone: 'Europe/Warsaw',
          workStart: '08:00',
        }),
      );

      expect(html).toContain('Zadania ze strony 42');
      expect(html).toContain('Powtórka do sprawdzianu');
      expect(html).toContain('Do zaplanowania: 2 zadań');
    });
  });

  describe('CloseDayBanner rendering', () => {
    it('should NOT render CloseDayBanner when unclosedBlocks is empty', () => {
      const html = renderToStaticMarkup(
        React.createElement(CalendarPageContent, {
          tasks: [],
          taskTypes: createMockTaskTypes(),
          unclosedBlocks: [],
          timeZone: 'Europe/Warsaw',
          workStart: '08:00',
        }),
      );

      expect(html).not.toContain('Niezamknięte bloki');
    });

    it('should render CloseDayBanner at the top with block details when unclosedBlocks are provided', () => {
      const unclosedBlocks = createMockUnclosedBlocks();
      const html = renderToStaticMarkup(
        React.createElement(CalendarPageContent, {
          tasks: [],
          taskTypes: createMockTaskTypes(),
          unclosedBlocks,
          timeZone: 'Europe/Warsaw',
          workStart: '08:00',
        }),
      );

      expect(html).toContain('Niezamknięte bloki (1)');
      expect(html).toContain('Algebra');
      expect(html).toContain('Zrobione');
      expect(html).toContain('Nie zrobione');
    });
  });

  describe('Responsive layout and semantic landmarks (G4, G7, G12)', () => {
    it('should render mobile action bar with SheetTrigger button and valid landmarks without nested main/aside', () => {
      const html = renderToStaticMarkup(
        React.createElement(CalendarPageContent, {
          tasks: createMockBacklogTasks(),
          taskTypes: createMockTaskTypes(),
          unclosedBlocks: [],
          timeZone: 'Europe/Warsaw',
          workStart: '08:00',
        }),
      );

      // Mobile action bar container
      expect(html).toContain('lg:hidden');
      expect(html).toContain('Do zaplanowania');

      // Desktop layout columns
      expect(html).toContain('aria-label="Panel boczny zadań"');
      // G4: calendar column must be section, never main
      expect(html).toContain('<section aria-label="Widok kalendarza"');
      expect(html).not.toContain('<main');

      // G12: sidebar has its own aside, and must not be wrapped inside a duplicate aside
      expect(html).toContain('aria-label="Boczny panel kalendarza"');
      expect(html).not.toContain('aria-label="Panel boczny nawigacji kalendarza"');
      expect(html).not.toMatch(/<aside[^>]*>(?:(?!<\/aside>)[\s\S])*<aside/);

      // Check FullCalendar is rendered
      expect(html).toContain('data-testid="mock-full-calendar"');
    });

    it('should pass recurring events to CalendarSidebar and render recurring events dialog (G7)', () => {
      const html = renderToStaticMarkup(
        React.createElement(CalendarPageContent, {
          tasks: [],
          taskTypes: createMockTaskTypes(),
          unclosedBlocks: [],
          recurringEvents: [],
          timeZone: 'Europe/Warsaw',
          workStart: '08:00',
        }),
      );

      expect(html).toContain('data-testid="mock-recurring-dialog"');
      expect(html).toContain('Plan lekcji');
    });

    it('should render type filter in sidebar with correct counts and color markers', () => {
      const taskTypes = createMockTaskTypes();
      const html = renderToStaticMarkup(
        React.createElement(CalendarPageContent, {
          tasks: [],
          taskTypes,
          unclosedBlocks: [],
          timeZone: 'Europe/Warsaw',
          workStart: '08:00',
        }),
      );

      expect(html).toContain('Filtruj zadania');
      expect(html).toContain('2/2');
      expect(html).toContain('Matematyka');
      expect(html).toContain('Historia');
    });
  });

  describe('resolveCalendarDateChange (G6)', () => {
    it('should preserve specifically chosen day when FullCalendar week view reports week start (Monday) of same week', () => {
      // User selected Thursday 2026-10-15; FullCalendar timeGridWeek reports Monday 2026-10-12
      const selected = '2026-10-15';
      const calendarWeekStart = '2026-10-12';
      const result = resolveCalendarDateChange(selected, calendarWeekStart, 'timeGridWeek');

      expect(result).toBe('2026-10-15');
    });

    it('should update selected day when navigating to a different week in timeGridWeek', () => {
      // User selected 2026-10-15, then clicked next week to 2026-10-19
      const selected = '2026-10-15';
      const newWeekStart = '2026-10-19';
      const result = resolveCalendarDateChange(selected, newWeekStart, 'timeGridWeek');

      expect(result).toBe('2026-10-19');
    });

    it('should always update selected day in timeGridDay view even if date equals Monday of current week', () => {
      // In day view, every reported date is the specific day to display
      const selected = '2026-10-15';
      const mondayDay = '2026-10-12';
      const result = resolveCalendarDateChange(selected, mondayDay, 'timeGridDay');

      expect(result).toBe('2026-10-12');
    });
  });
});
