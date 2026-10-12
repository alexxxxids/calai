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
vi.mock('@/features/planner', () => ({
  replanForUser: vi.fn(),
}));

import { revalidatePath } from 'next/cache';

import { replanForUser } from '@/features/planner';
import { getCurrentUser } from '@/lib/auth';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';

import { confirmDecomposition, confirmTimetable } from './actions';

describe('features/ai/actions: confirmDecomposition', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const typeId = '22222222-2222-4222-8222-222222222222';
  const taskId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(replanForUser).mockResolvedValue({ placed: 1, unscheduled: [] });
  });

  it('should return fail with validation errors when input is invalid', async () => {
    const result = await confirmDecomposition({
      typeId: 'not-a-uuid',
      priority: 99,
      sessionMinutes: 13,
      topics: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Nieprawidłowe dane dekompozycji');
      expect(result.fieldErrors?.typeId).toBeDefined();
      expect(result.fieldErrors?.priority).toBeDefined();
      expect(result.fieldErrors?.sessionMinutes).toBeDefined();
      expect(result.fieldErrors?.topics).toBeDefined();
    }
    expect(createClient).not.toHaveBeenCalled();
    expect(replanForUser).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('should return fail when user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(createClient).mockResolvedValue({} as ServerSupabase);

    const result = await confirmDecomposition({
      typeId,
      priority: 2,
      sessionMinutes: 45,
      topics: [{ title: 'Temat 1', workMinutes: 45 }],
    });

    expect(result).toEqual({ ok: false, error: 'Musisz być zalogowany' });
    expect(replanForUser).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('should successfully insert task, calculate deadline in timezone, and trigger replan', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'student@example.com' });

    let insertedRow: Record<string, unknown> | null = null;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { timezone: 'Europe/Warsaw' },
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === 'tasks') {
          return {
            insert: vi.fn((row: Record<string, unknown>) => {
              insertedRow = row;
              return {
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: taskId },
                    error: null,
                  }),
                })),
              };
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await confirmDecomposition({
      typeId,
      priority: 2,
      deadline: '2026-10-15T18:00',
      sessionMinutes: 45,
      topics: [
        { title: 'Pierwsza część', workMinutes: 45 },
        { title: 'Druga część', workMinutes: 30 },
      ],
    });

    expect(result).toEqual({ ok: true, data: { taskId } });
    expect(insertedRow).toEqual({
      type_id: typeId,
      priority: 2,
      status: 'active',
      fixation: 'flexible',
      estimate_minutes: 75,
      session_minutes: 45,
      notes: 'Tematy:\n1. Pierwsza część — 45 min\n2. Druga część — 30 min',
      deadline: '2026-10-15T16:00:00.000Z',
    });
    expect(insertedRow).not.toHaveProperty('user_id');
    expect(replanForUser).toHaveBeenCalledWith(mockSupabase, userId, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('should handle null deadline and fallback to default timezone when profile timezone is missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'student@example.com' });

    let insertedRow: Record<string, unknown> | null = null;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          };
        }
        if (table === 'tasks') {
          return {
            insert: vi.fn((row: Record<string, unknown>) => {
              insertedRow = row;
              return {
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: taskId },
                    error: null,
                  }),
                })),
              };
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await confirmDecomposition({
      typeId,
      priority: 1,
      deadline: null,
      sessionMinutes: 30,
      topics: [{ title: 'Jeden temat', workMinutes: 20 }],
    });

    expect(result).toEqual({ ok: true, data: { taskId } });
    expect(insertedRow).toMatchObject({
      deadline: null,
      estimate_minutes: 20,
      session_minutes: 30,
    });
  });

  it('should return fail with invalid type message when insert fails with code 23503', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'student@example.com' });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          };
        }
        if (table === 'tasks') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: '23503', message: 'Foreign key violation' },
                }),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await confirmDecomposition({
      typeId,
      priority: 2,
      sessionMinutes: 45,
      topics: [{ title: 'Temat', workMinutes: 30 }],
    });

    expect(result).toEqual({ ok: false, error: 'Nieprawidłowy typ zadania' });
    expect(replanForUser).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('should return fail when insert fails with generic database error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'student@example.com' });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          };
        }
        if (table === 'tasks') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: '42P01', message: 'Table error' },
                }),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await confirmDecomposition({
      typeId,
      priority: 2,
      sessionMinutes: 45,
      topics: [{ title: 'Temat', workMinutes: 30 }],
    });

    expect(result).toEqual({ ok: false, error: 'Nie udało się utworzyć zadania' });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('should still succeed and return taskId if replanForUser throws an error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'student@example.com' });
    vi.mocked(replanForUser).mockRejectedValue(new Error('Planner timeout'));

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          };
        }
        if (table === 'tasks') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: taskId },
                  error: null,
                }),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await confirmDecomposition({
      typeId,
      priority: 2,
      sessionMinutes: 45,
      topics: [{ title: 'Temat', workMinutes: 30 }],
    });

    expect(result).toEqual({ ok: true, data: { taskId } });
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('should return unexpected failure when an unhandled exception is thrown', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('Database crash'));

    const result = await confirmDecomposition({
      typeId,
      priority: 2,
      sessionMinutes: 45,
      topics: [{ title: 'Temat', workMinutes: 30 }],
    });

    expect(result).toEqual({
      ok: false,
      error: 'Coś poszło nie tak. Spróbuj ponownie za chwilę.',
    });
  });
});

describe('features/ai/actions: confirmTimetable', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const typeId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(replanForUser).mockResolvedValue({ placed: 2, unscheduled: [] });
  });

  it('should return fail with validation errors when input is invalid', async () => {
    const result = await confirmTimetable({
      typeId: 'invalid-id',
      validFrom: '2026-10-12',
      validUntil: '2026-10-01', // earlier than validFrom
      events: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Nieprawidłowe dane planu lekcji');
      expect(result.fieldErrors?.typeId).toBeDefined();
      expect(result.fieldErrors?.validUntil).toBeDefined();
      expect(result.fieldErrors?.events).toBeDefined();
    }
    expect(createClient).not.toHaveBeenCalled();
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('should return fail when user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(createClient).mockResolvedValue({} as ServerSupabase);

    const result = await confirmTimetable({
      typeId,
      validFrom: '2026-10-12',
      validUntil: '2027-06-25',
      events: [
        {
          title: 'Matematyka',
          weekday: 1,
          startTime: '08:00',
          endTime: '08:45',
        },
      ],
    });

    expect(result).toEqual({ ok: false, error: 'Musisz być zalogowany' });
    expect(replanForUser).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('should successfully insert recurring events with normalized times and trigger replan', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'student@example.com' });

    let insertedRows: Record<string, unknown>[] | null = null;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'recurring_events') {
          return {
            insert: vi.fn((rows: Record<string, unknown>[]) => {
              insertedRows = rows;
              return Promise.resolve({ error: null });
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await confirmTimetable({
      typeId,
      validFrom: '2026-10-12',
      validUntil: '2027-06-25',
      events: [
        {
          title: 'Matematyka',
          weekday: 1,
          startTime: '08:00',
          endTime: '08:45',
        },
        {
          title: 'Fizyka',
          weekday: 2,
          startTime: '09:00',
          endTime: '09:45',
        },
      ],
    });

    expect(result).toEqual({ ok: true, data: { count: 2 } });
    expect(insertedRows).toEqual([
      {
        title: 'Matematyka',
        type_id: typeId,
        weekday: 1,
        start_time: '08:00:00',
        end_time: '08:45:00',
        valid_from: '2026-10-12',
        valid_until: '2027-06-25',
      },
      {
        title: 'Fizyka',
        type_id: typeId,
        weekday: 2,
        start_time: '09:00:00',
        end_time: '09:45:00',
        valid_from: '2026-10-12',
        valid_until: '2027-06-25',
      },
    ]);
    expect(insertedRows?.[0]).not.toHaveProperty('user_id');
    expect(insertedRows?.[1]).not.toHaveProperty('user_id');
    expect(replanForUser).toHaveBeenCalledWith(mockSupabase, userId, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('should return fail with invalid type message when recurring_events insert fails with code 23503', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'student@example.com' });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'recurring_events') {
          return {
            insert: vi.fn(() =>
              Promise.resolve({
                error: { code: '23503', message: 'Foreign key violation' },
              }),
            ),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await confirmTimetable({
      typeId,
      validFrom: '2026-10-12',
      validUntil: '2027-06-25',
      events: [
        {
          title: 'Matematyka',
          weekday: 1,
          startTime: '08:00',
          endTime: '08:45',
        },
      ],
    });

    expect(result).toEqual({ ok: false, error: 'Nieprawidłowy typ zadania' });
    expect(replanForUser).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('should return fail when recurring_events insert fails with generic error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'student@example.com' });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'recurring_events') {
          return {
            insert: vi.fn(() =>
              Promise.resolve({
                error: { code: '42P01', message: 'Table error' },
              }),
            ),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await confirmTimetable({
      typeId,
      validFrom: '2026-10-12',
      validUntil: '2027-06-25',
      events: [
        {
          title: 'Matematyka',
          weekday: 1,
          startTime: '08:00',
          endTime: '08:45',
        },
      ],
    });

    expect(result).toEqual({ ok: false, error: 'Nie udało się zapisać planu lekcji' });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('should still succeed and return count if replanForUser throws an error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'student@example.com' });
    vi.mocked(replanForUser).mockRejectedValue(new Error('Planner timeout'));

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'recurring_events') {
          return {
            insert: vi.fn(() => Promise.resolve({ error: null })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await confirmTimetable({
      typeId,
      validFrom: '2026-10-12',
      validUntil: '2027-06-25',
      events: [
        {
          title: 'Matematyka',
          weekday: 1,
          startTime: '08:00',
          endTime: '08:45',
        },
      ],
    });

    expect(result).toEqual({ ok: true, data: { count: 1 } });
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('should return unexpected failure when an unhandled exception is thrown', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('Crash'));

    const result = await confirmTimetable({
      typeId,
      validFrom: '2026-10-12',
      validUntil: '2027-06-25',
      events: [
        {
          title: 'Matematyka',
          weekday: 1,
          startTime: '08:00',
          endTime: '08:45',
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      error: 'Coś poszło nie tak. Spróbuj ponownie za chwilę.',
    });
  });
});
