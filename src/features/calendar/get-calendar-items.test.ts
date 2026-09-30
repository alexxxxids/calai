import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { ServerSupabase } from '@/lib/supabase/server';

import {
  DEFAULT_TIMEZONE,
  fetchBlocks,
  fetchExternalEvents,
  fetchProfileTimezone,
  fetchRecurringEvents,
  fetchTaskTypes,
  getCalendarItems,
} from './get-calendar-items';
import type { CalendarRange } from './types';

function createQueryMock(data: unknown, error: { message: string } | null = null) {
  const mock: Record<string, unknown> = {};
  const self = () => mock;

  mock.select = vi.fn(self);
  mock.eq = vi.fn(self);
  mock.is = vi.fn(self);
  mock.order = vi.fn(self);
  mock.lt = vi.fn(self);
  mock.gt = vi.fn(self);
  mock.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  mock.single = vi.fn().mockResolvedValue({ data, error });
  mock.then = (resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(resolve, reject);

  return mock;
}

describe('get-calendar-items: decomposed fetchers', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const range: CalendarRange = {
    start: '2026-10-05T00:00:00.000Z',
    end: '2026-10-12T00:00:00.000Z',
  };

  it('fetchProfileTimezone: returns timezone when profile exists', async () => {
    const queryMock = createQueryMock({ timezone: 'America/New_York' });
    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    const tz = await fetchProfileTimezone(mockSupabase, userId);

    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(queryMock.select).toHaveBeenCalledWith('timezone');
    expect(queryMock.eq).toHaveBeenCalledWith('id', userId);
    expect(tz).toBe('America/New_York');
  });

  it('fetchProfileTimezone: falls back to DEFAULT_TIMEZONE when profile is null', async () => {
    const queryMock = createQueryMock(null);
    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    const tz = await fetchProfileTimezone(mockSupabase, userId);

    expect(tz).toBe(DEFAULT_TIMEZONE);
    expect(tz).toBe('Europe/Warsaw');
  });

  it('fetchProfileTimezone: throws when query fails', async () => {
    const queryMock = createQueryMock(null, { message: 'Profiles table unreachable' });
    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    await expect(fetchProfileTimezone(mockSupabase, userId)).rejects.toThrow(
      'Błąd pobierania strefy czasowej: Profiles table unreachable',
    );
  });

  it('fetchTaskTypes: queries task types for user and returns rows', async () => {
    const taskTypesData = [
      { id: 'type-1', name: 'Nauka', color: '#3b82f6', energy: 3, is_rest: false },
      { id: 'type-rest', name: 'Odpoczynek', color: '#10b981', energy: 0, is_rest: true },
    ];
    const queryMock = createQueryMock(taskTypesData);
    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    const result = await fetchTaskTypes(mockSupabase, userId);

    expect(mockSupabase.from).toHaveBeenCalledWith('task_types');
    expect(queryMock.select).toHaveBeenCalledWith('id, name, color, energy, is_rest');
    expect(queryMock.eq).toHaveBeenCalledWith('user_id', userId);
    expect(queryMock.is).toHaveBeenCalledWith('archived_at', null);
    expect(queryMock.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result).toEqual(taskTypesData);
  });

  it('fetchTaskTypes: throws when query fails', async () => {
    const queryMock = createQueryMock(null, { message: 'Permission denied' });
    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    await expect(fetchTaskTypes(mockSupabase, userId)).rejects.toThrow(
      'Błąd pobierania typów zadań: Permission denied',
    );
  });

  it('fetchBlocks: queries blocks with relations and filters by user and range', async () => {
    const blocksData = [
      {
        id: 'block-1',
        task_id: 'task-1',
        starts_at: '2026-10-06T08:00:00.000Z',
        ends_at: '2026-10-06T09:30:00.000Z',
        work_minutes: 90,
        status: 'planned',
        source: 'manual',
        pinned: false,
        tasks: {
          id: 'task-1',
          fixation: 'flexible',
          type_id: 'type-1',
          task_types: { id: 'type-1', name: 'Nauka', color: '#3b82f6', energy: 3 },
        },
      },
    ];
    const queryMock = createQueryMock(blocksData);
    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    const result = await fetchBlocks(mockSupabase, userId, range);

    expect(mockSupabase.from).toHaveBeenCalledWith('blocks');
    expect(queryMock.eq).toHaveBeenCalledWith('user_id', userId);
    expect(queryMock.lt).toHaveBeenCalledWith('starts_at', range.end);
    expect(queryMock.gt).toHaveBeenCalledWith('ends_at', range.start);
    expect(result).toEqual(blocksData);
  });

  it('fetchBlocks: throws when query fails', async () => {
    const queryMock = createQueryMock(null, { message: 'Timeout' });
    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    await expect(fetchBlocks(mockSupabase, userId, range)).rejects.toThrow(
      'Błąd pobierania bloków: Timeout',
    );
  });

  it('fetchRecurringEvents: queries recurring events for user with types', async () => {
    const recurringData = [
      {
        id: 'rec-1',
        title: 'Matematyka',
        type_id: 'type-1',
        weekday: 1,
        start_time: '08:00:00',
        end_time: '08:45:00',
        valid_from: '2026-09-01',
        valid_until: '2027-06-25',
        task_types: { id: 'type-1', name: 'Szkoła', color: '#f59e0b', energy: 2 },
      },
    ];
    const queryMock = createQueryMock(recurringData);
    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    const result = await fetchRecurringEvents(mockSupabase, userId);

    expect(mockSupabase.from).toHaveBeenCalledWith('recurring_events');
    expect(queryMock.eq).toHaveBeenCalledWith('user_id', userId);
    expect(result).toEqual(recurringData);
  });

  it('fetchRecurringEvents: throws when query fails', async () => {
    const queryMock = createQueryMock(null, { message: 'Database error' });
    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    await expect(fetchRecurringEvents(mockSupabase, userId)).rejects.toThrow(
      'Błąd pobierania powtarzających się wydarzeń: Database error',
    );
  });

  it('fetchExternalEvents: queries external events with subscriptions and types', async () => {
    const externalData = [
      {
        id: 'ext-1',
        title: 'Wizyta u lekarza',
        starts_at: '2026-10-07T14:00:00.000Z',
        ends_at: '2026-10-07T15:00:00.000Z',
        subscription_id: 'sub-1',
        calendar_subscriptions: {
          id: 'sub-1',
          type_id: 'type-ext',
          task_types: { id: 'type-ext', name: 'Kalendarz Google', color: '#6366f1', energy: 1 },
        },
      },
    ];
    const queryMock = createQueryMock(externalData);
    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    const result = await fetchExternalEvents(mockSupabase, userId, range);

    expect(mockSupabase.from).toHaveBeenCalledWith('external_events');
    expect(queryMock.eq).toHaveBeenCalledWith('user_id', userId);
    expect(queryMock.lt).toHaveBeenCalledWith('starts_at', range.end);
    expect(queryMock.gt).toHaveBeenCalledWith('ends_at', range.start);
    expect(result).toEqual(externalData);
  });

  it('fetchExternalEvents: throws when query fails', async () => {
    const queryMock = createQueryMock(null, { message: 'Sync lock active' });
    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    await expect(fetchExternalEvents(mockSupabase, userId, range)).rejects.toThrow(
      'Błąd pobierania wydarzeń zewnętrznych: Sync lock active',
    );
  });
});

describe('get-calendar-items: getCalendarItems integration', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const range: CalendarRange = {
    start: '2026-10-05T00:00:00.000Z', // Monday
    end: '2026-10-12T00:00:00.000Z', // Next Monday
  };

  it('returns empty array when all tables return empty datasets', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return createQueryMock({ timezone: 'Europe/Warsaw' });
        }
        return createQueryMock([]);
      }),
    } as unknown as ServerSupabase;

    const items = await getCalendarItems(mockSupabase, userId, range);

    expect(items).toEqual([]);
  });

  it('combines blocks, recurring events, and external events into a sorted array', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return createQueryMock({ timezone: 'Europe/Warsaw' });
        }
        if (table === 'task_types') {
          return createQueryMock([
            { id: 'type-nauka', name: 'Nauka', color: '#3b82f6', energy: 3, is_rest: false },
            { id: 'type-rest', name: 'Odpoczynek', color: '#22c55e', energy: 0, is_rest: true },
          ]);
        }
        if (table === 'blocks') {
          return createQueryMock([
            {
              id: 'block-task',
              task_id: 'task-1',
              starts_at: '2026-10-06T10:00:00.000Z',
              ends_at: '2026-10-06T11:00:00.000Z',
              work_minutes: 60,
              status: 'planned',
              source: 'manual',
              pinned: true,
              tasks: {
                id: 'task-1',
                fixation: 'flexible',
                type_id: 'type-nauka',
                task_types: { id: 'type-nauka', name: 'Nauka', color: '#3b82f6', energy: 3 },
              },
            },
            {
              id: 'block-rest',
              task_id: null,
              starts_at: '2026-10-06T11:00:00.000Z',
              ends_at: '2026-10-06T11:15:00.000Z',
              work_minutes: 15,
              status: 'planned',
              source: 'rest',
              pinned: false,
              tasks: null,
            },
          ]);
        }
        if (table === 'recurring_events') {
          return createQueryMock([
            {
              id: 'rec-1',
              title: 'Lekcja biologii',
              type_id: 'type-nauka',
              weekday: 2, // Tuesday (2026-10-06)
              start_time: '08:00:00',
              end_time: '08:45:00',
              valid_from: '2026-09-01',
              valid_until: '2027-06-25',
              task_types: { id: 'type-nauka', name: 'Nauka', color: '#3b82f6', energy: 3 },
            },
          ]);
        }
        if (table === 'external_events') {
          return createQueryMock([
            {
              id: 'ext-1',
              title: 'Trening',
              starts_at: '2026-10-06T16:00:00.000Z',
              ends_at: '2026-10-06T17:30:00.000Z',
              subscription_id: 'sub-1',
              calendar_subscriptions: {
                id: 'sub-1',
                type_id: 'type-nauka',
                task_types: { id: 'type-nauka', name: 'Sport', color: '#ef4444', energy: 2 },
              },
            },
          ]);
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    const items = await getCalendarItems(mockSupabase, userId, range);

    expect(items).toHaveLength(4);

    // Tuesday 2026-10-06 in Europe/Warsaw (CEST is UTC+2):
    // 08:00 CEST -> 06:00 UTC
    expect(items[0]).toEqual({
      id: 'rec-1-2026-10-06T06:00:00.000Z',
      title: 'Lekcja biologii',
      start: '2026-10-06T06:00:00.000Z',
      end: '2026-10-06T06:45:00.000Z',
      color: '#3b82f6',
      editable: false,
      extendedProps: {
        kind: 'recurring',
        status: null,
        pinned: false,
        taskId: null,
        energy: 3,
        typeId: 'type-nauka',
      },
    });

    // Block-task: 10:00 UTC
    expect(items[1]).toEqual({
      id: 'block-task',
      title: 'Nauka',
      start: '2026-10-06T10:00:00.000Z',
      end: '2026-10-06T11:00:00.000Z',
      color: '#3b82f6',
      editable: true,
      extendedProps: {
        kind: 'block',
        status: 'planned',
        pinned: true,
        taskId: 'task-1',
        energy: 3,
        typeId: 'type-nauka',
      },
    });

    // Block-rest: 11:00 UTC
    expect(items[2]).toEqual({
      id: 'block-rest',
      title: 'Odpoczynek',
      start: '2026-10-06T11:00:00.000Z',
      end: '2026-10-06T11:15:00.000Z',
      color: '#22c55e',
      editable: false,
      extendedProps: {
        kind: 'block',
        status: 'planned',
        pinned: false,
        taskId: null,
        energy: 0,
        typeId: 'type-rest',
      },
    });

    // Ext-1: 16:00 UTC
    expect(items[3]).toEqual({
      id: 'ext-1',
      title: 'Trening',
      start: '2026-10-06T16:00:00.000Z',
      end: '2026-10-06T17:30:00.000Z',
      color: '#ef4444',
      editable: false,
      extendedProps: {
        kind: 'external',
        status: null,
        pinned: false,
        taskId: null,
        energy: 2,
        typeId: 'type-nauka',
      },
    });
  });

  it('performs secondary sort by end when start dates are equal', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return createQueryMock({ timezone: 'Europe/Warsaw' });
        }
        if (table === 'blocks') {
          return createQueryMock([
            {
              id: 'block-longer',
              task_id: 'task-1',
              starts_at: '2026-10-06T10:00:00.000Z',
              ends_at: '2026-10-06T12:00:00.000Z', // Ends later
              work_minutes: 120,
              status: 'planned',
              source: 'manual',
              pinned: false,
              tasks: null,
            },
            {
              id: 'block-shorter',
              task_id: 'task-2',
              starts_at: '2026-10-06T10:00:00.000Z',
              ends_at: '2026-10-06T10:30:00.000Z', // Ends earlier
              work_minutes: 30,
              status: 'planned',
              source: 'manual',
              pinned: false,
              tasks: null,
            },
          ]);
        }
        return createQueryMock([]);
      }),
    } as unknown as ServerSupabase;

    const items = await getCalendarItems(mockSupabase, userId, range);

    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe('block-shorter');
    expect(items[1]?.id).toBe('block-longer');
  });

  it('performs tertiary sort by id when start and end dates are equal', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return createQueryMock({ timezone: 'Europe/Warsaw' });
        }
        if (table === 'blocks') {
          return createQueryMock([
            {
              id: 'block-z',
              task_id: 'task-1',
              starts_at: '2026-10-06T10:00:00.000Z',
              ends_at: '2026-10-06T11:00:00.000Z',
              work_minutes: 60,
              status: 'planned',
              source: 'manual',
              pinned: false,
              tasks: null,
            },
            {
              id: 'block-a',
              task_id: 'task-2',
              starts_at: '2026-10-06T10:00:00.000Z',
              ends_at: '2026-10-06T11:00:00.000Z',
              work_minutes: 60,
              status: 'planned',
              source: 'manual',
              pinned: false,
              tasks: null,
            },
          ]);
        }
        return createQueryMock([]);
      }),
    } as unknown as ServerSupabase;

    const items = await getCalendarItems(mockSupabase, userId, range);

    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe('block-a');
    expect(items[1]?.id).toBe('block-z');
  });

  it('uses default fallback timezone when user profile is missing', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return createQueryMock(null); // Missing profile row
        }
        if (table === 'recurring_events') {
          return createQueryMock([
            {
              id: 'rec-fallback',
              title: 'Lekcja',
              type_id: 'type-1',
              weekday: 1, // Monday (2026-10-05)
              start_time: '08:00:00',
              end_time: '08:45:00',
              valid_from: '2026-09-01',
              valid_until: null,
              task_types: null,
            },
          ]);
        }
        return createQueryMock([]);
      }),
    } as unknown as ServerSupabase;

    const items = await getCalendarItems(mockSupabase, userId, range);

    expect(items).toHaveLength(1);
    // In Europe/Warsaw (CEST, UTC+2 on 2026-10-05): 08:00 -> 06:00Z
    expect(items[0]?.start).toBe('2026-10-05T06:00:00.000Z');
  });

  it('propagates error when one of the queries fails', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'blocks') {
          return createQueryMock(null, { message: 'Database query failed' });
        }
        if (table === 'profiles') {
          return createQueryMock({ timezone: 'Europe/Warsaw' });
        }
        return createQueryMock([]);
      }),
    } as unknown as ServerSupabase;

    await expect(getCalendarItems(mockSupabase, userId, range)).rejects.toThrow(
      'Błąd pobierania bloków: Database query failed',
    );
  });
});
