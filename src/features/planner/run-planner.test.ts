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
vi.mock('./replan', () => ({
  replanForUser: vi.fn(),
}));

import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/lib/auth';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';

import { replanForUser } from './replan';
import { runPlanner } from './run-planner';

interface MockTableData {
  readonly tasks?: { readonly data: unknown; readonly error: { readonly message: string } | null };
  readonly task_types?: { readonly data: unknown; readonly error: { readonly message: string } | null };
}

function createMockSupabase(tableData: MockTableData = {}) {
  return {
    from: vi.fn((table: string) => {
      const response = tableData[table as keyof MockTableData] ?? { data: [], error: null };
      const builder = {
        select: vi.fn(() => builder),
        in: vi.fn(() => Promise.resolve(response)),
      };
      return builder;
    }),
  };
}

describe('runPlanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const defaultSupabase = createMockSupabase();
    vi.mocked(createClient).mockResolvedValue(defaultSupabase as unknown as ServerSupabase);
  });

  it('should return unauthorized when user is not logged in', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    // Act
    const result = await runPlanner();

    // Assert
    expect(result).toEqual({ ok: false, error: 'Sesja wygasła. Zaloguj się ponownie.' });
    expect(replanForUser).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('should return ok with placed count and empty unscheduled list when all tasks fit', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    vi.mocked(replanForUser).mockResolvedValue({ placed: 4, unscheduled: [] });

    // Act
    const result = await runPlanner();

    // Assert
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
    expect(result).toEqual({
      ok: true,
      data: {
        placed: 4,
        unscheduled: [],
      },
    });
  });

  it('should return ok with resolved task titles for unscheduled tasks', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    vi.mocked(replanForUser).mockResolvedValue({
      placed: 2,
      unscheduled: [
        { taskId: 'task-1', missingMinutes: 45, reason: 'deadline' },
        { taskId: 'task-2', missingMinutes: 30, reason: 'capacity' },
        { taskId: 'task-3', missingMinutes: 15, reason: 'capacity' },
      ],
    });

    const mockSupabase = createMockSupabase({
      tasks: {
        data: [
          { id: 'task-1', notes: 'Zadania z fizyki', type_id: 'type-study' },
          { id: 'task-2', notes: '   ', type_id: 'type-code' },
          { id: 'task-3', notes: null, type_id: 'type-reading' },
        ],
        error: null,
      },
      task_types: {
        data: [
          { id: 'type-study', name: 'Nauka' },
          { id: 'type-code', name: 'Programowanie' },
          { id: 'type-reading', name: 'Czytanie' },
        ],
        error: null,
      },
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ServerSupabase);

    // Act
    const result = await runPlanner();

    // Assert
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
    expect(result).toEqual({
      ok: true,
      data: {
        placed: 2,
        unscheduled: [
          {
            taskId: 'task-1',
            taskTitle: 'Nauka: Zadania z fizyki',
            missingMinutes: 45,
            reason: 'deadline',
          },
          {
            taskId: 'task-2',
            taskTitle: 'Programowanie',
            missingMinutes: 30,
            reason: 'capacity',
          },
          {
            taskId: 'task-3',
            taskTitle: 'Czytanie',
            missingMinutes: 15,
            reason: 'capacity',
          },
        ],
      },
    });
  });

  it('should fallback to default task title Zadanie when task type or task cannot be found', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    vi.mocked(replanForUser).mockResolvedValue({
      placed: 0,
      unscheduled: [
        { taskId: 'task-unknown', missingMinutes: 20, reason: 'capacity' },
        { taskId: 'task-no-type', missingMinutes: 25, reason: 'deadline' },
      ],
    });

    const mockSupabase = createMockSupabase({
      tasks: {
        data: [{ id: 'task-no-type', notes: 'Notatka', type_id: 'type-missing' }],
        error: null,
      },
      task_types: {
        data: [],
        error: null,
      },
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ServerSupabase);

    // Act
    const result = await runPlanner();

    // Assert
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
    expect(result).toEqual({
      ok: true,
      data: {
        placed: 0,
        unscheduled: [
          {
            taskId: 'task-unknown',
            taskTitle: 'Zadanie',
            missingMinutes: 20,
            reason: 'capacity',
          },
          {
            taskId: 'task-no-type',
            taskTitle: 'Zadanie: Notatka',
            missingMinutes: 25,
            reason: 'deadline',
          },
        ],
      },
    });
  });

  it('should return fail with concurrency message when replanForUser throws concurrency conflict', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    vi.mocked(replanForUser).mockRejectedValue(
      new Error('Plan się zmienił, spróbuj ponownie'),
    );

    // Act
    const result = await runPlanner();

    // Assert
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'Plan się zmienił, spróbuj ponownie' });
  });

  it('should return unexpected failure when replanForUser throws an unhandled error', async () => {
    // Arrange
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    vi.mocked(replanForUser).mockRejectedValue(new Error('Database network timeout'));

    // Act
    const result = await runPlanner();

    // Assert
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: 'Coś poszło nie tak. Spróbuj ponownie za chwilę.',
    });
    expect(consoleSpy).toHaveBeenCalledWith('[runPlanner]', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('should return unexpected failure when task resolution query fails', async () => {
    // Arrange
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    vi.mocked(replanForUser).mockResolvedValue({
      placed: 1,
      unscheduled: [{ taskId: 'task-1', missingMinutes: 30, reason: 'capacity' }],
    });

    const mockSupabase = createMockSupabase({
      tasks: {
        data: null,
        error: { message: 'DB connection error' },
      },
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ServerSupabase);

    // Act
    const result = await runPlanner();

    // Assert
    expect(result).toEqual({
      ok: false,
      error: 'Coś poszło nie tak. Spróbuj ponownie za chwilę.',
    });
    expect(consoleSpy).toHaveBeenCalledWith('[runPlanner]', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('should return unexpected failure when task types query fails', async () => {
    // Arrange
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    vi.mocked(replanForUser).mockResolvedValue({
      placed: 1,
      unscheduled: [{ taskId: 'task-1', missingMinutes: 30, reason: 'capacity' }],
    });

    const mockSupabase = createMockSupabase({
      tasks: {
        data: [{ id: 'task-1', notes: null, type_id: 'type-1' }],
        error: null,
      },
      task_types: {
        data: null,
        error: { message: 'DB types error' },
      },
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ServerSupabase);

    // Act
    const result = await runPlanner();

    // Assert
    expect(result).toEqual({
      ok: false,
      error: 'Coś poszło nie tak. Spróbuj ponownie za chwilę.',
    });
    expect(consoleSpy).toHaveBeenCalledWith('[runPlanner]', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('should truncate task notes longer than 80 characters with ellipsis', async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    vi.mocked(replanForUser).mockResolvedValue({
      placed: 0,
      unscheduled: [{ taskId: 'task-long', missingMinutes: 60, reason: 'deadline' }],
    });

    const longNotes = 'A'.repeat(120);
    const mockSupabase = createMockSupabase({
      tasks: {
        data: [{ id: 'task-long', notes: longNotes, type_id: 'type-long' }],
        error: null,
      },
      task_types: {
        data: [{ id: 'type-long', name: 'Projekt' }],
        error: null,
      },
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ServerSupabase);

    // Act
    const result = await runPlanner();

    // Assert
    expect(result).toEqual({
      ok: true,
      data: {
        placed: 0,
        unscheduled: [
          {
            taskId: 'task-long',
            taskTitle: `Projekt: ${'A'.repeat(80)}...`,
            missingMinutes: 60,
            reason: 'deadline',
          },
        ],
      },
    });
  });
});

