import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock('../planner', () => ({
  replanForUser: vi.fn(),
}));

import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/lib/auth';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';

import { replanForUser } from '../planner';
import { createRecurringEvents, deleteRecurringEvent } from './actions';
import { listRecurringEvents } from './queries';

interface QueryResult {
  readonly data: unknown;
  readonly error: { message?: string; code?: string } | null;
}

interface MockDbConfig {
  insertError?: { message?: string; code?: string } | null;
  deleteError?: { message?: string; code?: string } | null;
  selectData?: unknown;
  selectError?: { message?: string; code?: string } | null;
}

function buildMockSupabase(config: MockDbConfig = {}) {
  const insertedRows: Record<string, unknown>[] = [];
  const deleteEqCalls: Array<{ column: string; value: unknown }> = [];
  const selectEqCalls: Array<{ column: string; value: unknown }> = [];
  const orderCalls: Array<{ column: string; options?: { ascending?: boolean } }> = [];

  const mockClient = {
    from: vi.fn((table: string) => {
      if (table !== 'recurring_events') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        insert: vi.fn((rows: unknown) => {
          if (Array.isArray(rows)) {
            insertedRows.push(...(rows as Record<string, unknown>[]));
          } else if (typeof rows === 'object' && rows !== null) {
            insertedRows.push(rows as Record<string, unknown>);
          }
          const result: QueryResult = { data: null, error: config.insertError ?? null };
          return {
            then: (resolve: (val: QueryResult) => unknown, reject?: (err: unknown) => unknown) =>
              Promise.resolve(result).then(resolve, reject),
          };
        }),
        delete: vi.fn(() => {
          const deleteQuery = {
            eq: vi.fn((column: string, value: unknown) => {
              deleteEqCalls.push({ column, value });
              return deleteQuery;
            }),
            then: (resolve: (val: QueryResult) => unknown, reject?: (err: unknown) => unknown) => {
              const result: QueryResult = { data: null, error: config.deleteError ?? null };
              return Promise.resolve(result).then(resolve, reject);
            },
          };
          return deleteQuery;
        }),
        select: vi.fn(() => {
          const selectQuery = {
            eq: vi.fn((column: string, value: unknown) => {
              selectEqCalls.push({ column, value });
              return selectQuery;
            }),
            order: vi.fn((column: string, options?: { ascending?: boolean }) => {
              orderCalls.push({ column, options });
              return selectQuery;
            }),
            then: (resolve: (val: QueryResult) => unknown, reject?: (err: unknown) => unknown) => {
              const result: QueryResult = {
                data: config.selectData ?? [],
                error: config.selectError ?? null,
              };
              return Promise.resolve(result).then(resolve, reject);
            },
          };
          return selectQuery;
        }),
      };
    }),
  } as unknown as ServerSupabase;

  return {
    mockClient,
    insertedRows,
    deleteEqCalls,
    selectEqCalls,
    orderCalls,
  };
}

describe('recurring-events actions: createRecurringEvents', () => {
  const userId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  const typeId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

  const validEvent = {
    title: 'Matematyka',
    typeId,
    weekday: 2,
    startTime: '08:00',
    endTime: '08:45',
    validFrom: '2026-09-01',
    validUntil: '2027-06-25',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(replanForUser).mockResolvedValue({ placed: 0, unscheduled: [] });
    vi.mocked(createClient).mockReset();
    vi.mocked(getCurrentUser).mockReset();
  });

  it('returns unauthorized when user session is missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await createRecurringEvents({ events: [validEvent] });

    expect(result).toEqual({ ok: false, error: 'Sesja wygasła. Zaloguj się ponownie.' });
    expect(replanForUser).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns invalidInput when event title is empty', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const result = await createRecurringEvents({
      events: [{ ...validEvent, title: '   ' }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Popraw zaznaczone pola.');
      expect(result.fieldErrors?.['events.0.title']).toBeDefined();
    }
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('returns invalidInput when endTime is not after startTime', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const result = await createRecurringEvents({
      events: [{ ...validEvent, startTime: '10:00', endTime: '09:00' }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.['events.0.endTime']).toBeDefined();
    }
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('returns invalidInput when validUntil is earlier than validFrom', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const result = await createRecurringEvents({
      events: [{ ...validEvent, validFrom: '2026-09-01', validUntil: '2026-08-01' }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.['events.0.validUntil']).toBeDefined();
    }
  });

  it('returns invalidInput when weekday is outside 1..7', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const result = await createRecurringEvents({
      events: [{ ...validEvent, weekday: 8 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.['events.0.weekday']).toBeDefined();
    }
  });

  it('successfully creates batch of events when passed as object with events array', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient, insertedRows } = buildMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await createRecurringEvents({
      events: [
        validEvent,
        {
          title: 'Fizyka',
          typeId,
          weekday: 4,
          startTime: '09:00:00',
          endTime: '09:45:00',
          validFrom: '2026-09-01',
          validUntil: null,
        },
      ],
    });

    expect(result).toEqual({ ok: true, data: { count: 2 } });
    expect(insertedRows).toHaveLength(2);

    expect(insertedRows[0]).toEqual({
      title: 'Matematyka',
      type_id: typeId,
      weekday: 2,
      start_time: '08:00:00',
      end_time: '08:45:00',
      valid_from: '2026-09-01',
      valid_until: '2027-06-25',
    });
    // user_id is NOT in insert payload
    expect(insertedRows[0]?.user_id).toBeUndefined();

    expect(insertedRows[1]).toEqual({
      title: 'Fizyka',
      type_id: typeId,
      weekday: 4,
      start_time: '09:00:00',
      end_time: '09:45:00',
      valid_from: '2026-09-01',
      valid_until: null,
    });

    expect(replanForUser).toHaveBeenCalledWith(mockClient, userId, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('supports raw array input directly', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient, insertedRows } = buildMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await createRecurringEvents([validEvent]);

    expect(result).toEqual({ ok: true, data: { count: 1 } });
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]?.title).toBe('Matematyka');
  });

  it('supports single event object directly', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient, insertedRows } = buildMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await createRecurringEvents(validEvent);

    expect(result).toEqual({ ok: true, data: { count: 1 } });
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]?.title).toBe('Matematyka');
  });

  it('handles foreign key violation 23503 and returns descriptive error with fieldErrors', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({
      insertError: { code: '23503', message: 'foreign key violation' },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await createRecurringEvents({ events: [validEvent] });

    expect(result).toEqual({
      ok: false,
      error: 'Nieprawidłowy typ zadania',
      fieldErrors: { typeId: ['Nieprawidłowy typ zadania'] },
    });
    expect(replanForUser).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('handles generic database error without leaking raw details', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({
      insertError: { code: 'XX000', message: 'unexpected db crash' },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await createRecurringEvents({ events: [validEvent] });

    expect(result).toEqual({
      ok: false,
      error: 'Nie udało się zapisać powtarzających się wydarzeń',
    });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('returns unexpected when unhandled exception occurs', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    vi.mocked(createClient).mockRejectedValue(new Error('Network failure'));

    const result = await createRecurringEvents({ events: [validEvent] });

    expect(result).toEqual({
      ok: false,
      error: 'Coś poszło nie tak. Spróbuj ponownie za chwilę.',
    });
    consoleSpy.mockRestore();
  });
});

describe('recurring-events actions: deleteRecurringEvent', () => {
  const userId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  const eventId = 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(replanForUser).mockResolvedValue({ placed: 0, unscheduled: [] });
    vi.mocked(createClient).mockReset();
    vi.mocked(getCurrentUser).mockReset();
  });

  it('returns unauthorized when user session is missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await deleteRecurringEvent({ id: eventId });

    expect(result).toEqual({ ok: false, error: 'Sesja wygasła. Zaloguj się ponownie.' });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('returns invalidInput when id is not a valid UUID', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const result = await deleteRecurringEvent({ id: 'invalid-id' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.id).toBeDefined();
    }
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('successfully deletes recurring event, replans and revalidates', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient, deleteEqCalls } = buildMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await deleteRecurringEvent({ id: eventId });

    expect(result).toEqual({ ok: true, data: { id: eventId } });
    expect(deleteEqCalls).toEqual([
      { column: 'id', value: eventId },
      { column: 'user_id', value: userId },
    ]);
    expect(replanForUser).toHaveBeenCalledWith(mockClient, userId, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('handles database error when delete fails', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({
      deleteError: { message: 'db error', code: 'XX000' },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await deleteRecurringEvent({ id: eventId });

    expect(result).toEqual({
      ok: false,
      error: 'Nie udało się usunąć powtarzającego się wydarzenia',
    });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('returns unexpected when unhandled exception occurs during delete', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    vi.mocked(createClient).mockRejectedValue(new Error('Fatal error'));

    const result = await deleteRecurringEvent({ id: eventId });

    expect(result).toEqual({
      ok: false,
      error: 'Coś poszło nie tak. Spróbuj ponownie za chwilę.',
    });
    consoleSpy.mockRestore();
  });
});

describe('recurring-events queries: listRecurringEvents', () => {
  const userId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  const typeId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

  it('returns mapped recurring events with relations', async () => {
    const rawData = [
      {
        id: 'e1',
        title: 'Matematyka',
        type_id: typeId,
        weekday: 1,
        start_time: '08:00:00',
        end_time: '08:45:00',
        valid_from: '2026-09-01',
        valid_until: '2027-06-25',
        task_types: {
          id: typeId,
          name: 'Szkoła',
          color: '#3b82f6',
          energy: 2,
        },
      },
      {
        id: 'e2',
        title: 'Trening',
        type_id: typeId,
        weekday: 3,
        start_time: '17:00:00',
        end_time: '18:30:00',
        valid_from: '2026-09-01',
        valid_until: null,
        task_types: [
          {
            id: typeId,
            name: 'Sport',
            color: '#10b981',
            energy: 3,
          },
        ],
      },
    ];

    const { mockClient, selectEqCalls, orderCalls } = buildMockSupabase({
      selectData: rawData,
    });

    const events = await listRecurringEvents(mockClient, userId);

    expect(events).toEqual([
      {
        id: 'e1',
        title: 'Matematyka',
        type_id: typeId,
        weekday: 1,
        start_time: '08:00:00',
        end_time: '08:45:00',
        valid_from: '2026-09-01',
        valid_until: '2027-06-25',
        task_types: {
          id: typeId,
          name: 'Szkoła',
          color: '#3b82f6',
          energy: 2,
        },
      },
      {
        id: 'e2',
        title: 'Trening',
        type_id: typeId,
        weekday: 3,
        start_time: '17:00:00',
        end_time: '18:30:00',
        valid_from: '2026-09-01',
        valid_until: null,
        task_types: {
          id: typeId,
          name: 'Sport',
          color: '#10b981',
          energy: 3,
        },
      },
    ]);

    expect(selectEqCalls).toEqual([{ column: 'user_id', value: userId }]);
    expect(orderCalls).toEqual([
      { column: 'weekday', options: { ascending: true } },
      { column: 'start_time', options: { ascending: true } },
    ]);
  });

  it('throws descriptive Polish error on database error', async () => {
    const { mockClient } = buildMockSupabase({
      selectError: { message: 'relation not found' },
    });

    await expect(listRecurringEvents(mockClient, userId)).rejects.toThrow(
      'Nie udało się pobrać powtarzających się wydarzeń: relation not found',
    );
  });
});
