import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { ServerSupabase } from '@/lib/supabase/server';

import {
  calculateTaskPaceForTask,
  dailyMetricsFromClosedBlocks,
  deleteOverlappingUnpinnedBlocks,
  evaluateDayLoadWarning,
} from './block-mutation-helpers';
import { getBlockById, listUnclosedBlocks } from './queries';

function createQueryMock(data: unknown, error: { message: string } | null = null) {
  const mock: Record<string, unknown> = {};
  const self = () => mock;

  mock.select = vi.fn(self);
  mock.delete = vi.fn(self);
  mock.eq = vi.fn(self);
  mock.neq = vi.fn(self);
  mock.lt = vi.fn(self);
  mock.gt = vi.fn(self);
  mock.gte = vi.fn(self);
  mock.lte = vi.fn(self);
  mock.not = vi.fn(self);
  mock.in = vi.fn(self);
  mock.order = vi.fn(self);
  mock.limit = vi.fn(self);
  mock.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  mock.single = vi.fn().mockResolvedValue({ data, error });
  mock.then = (resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(resolve, reject);

  return mock;
}

describe('queries: listUnclosedBlocks', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const now = new Date('2026-09-25T12:00:00.000Z');

  it('returns unclosed planned blocks ending in the past within 14 days, sorted by starts_at asc', async () => {
    const queryMock = createQueryMock([
      {
        id: 'block-1',
        task_id: 'task-1',
        starts_at: '2026-09-24T09:00:00.000Z',
        ends_at: '2026-09-24T10:30:00.000Z',
        work_minutes: 90,
        tasks: {
          id: 'task-1',
          notes: 'Projekt z fizyki',
          priority: 1,
          task_types: {
            id: 'type-1',
            name: 'Nauka',
            color: '#3b82f6',
            energy: 3,
          },
        },
      },
      {
        id: 'block-2',
        task_id: 'task-2',
        starts_at: '2026-09-24T11:00:00.000Z',
        ends_at: '2026-09-24T12:00:00.000Z',
        work_minutes: 60,
        tasks: {
          id: 'task-2',
          notes: null,
          priority: 2,
          task_types: {
            id: 'type-2',
            name: 'Praca domowa',
            color: '#10b981',
            energy: 2,
          },
        },
      },
    ]);

    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    const result = await listUnclosedBlocks(mockSupabase, userId, now);

    expect(mockSupabase.from).toHaveBeenCalledWith('blocks');
    expect(queryMock.eq).toHaveBeenCalledWith('user_id', userId);
    expect(queryMock.eq).toHaveBeenCalledWith('status', 'planned');
    expect(queryMock.lt).toHaveBeenCalledWith('ends_at', '2026-09-25T12:00:00.000Z');
    expect(queryMock.gte).toHaveBeenCalledWith('ends_at', '2026-09-11T12:00:00.000Z');
    expect(queryMock.order).toHaveBeenCalledWith('starts_at', { ascending: true });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'block-1',
      taskId: 'task-1',
      startsAt: '2026-09-24T09:00:00.000Z',
      endsAt: '2026-09-24T10:30:00.000Z',
      workMinutes: 90,
      typeName: 'Nauka',
      typeColor: '#3b82f6',
      typeEnergy: 3,
      notes: 'Projekt z fizyki',
    });
    expect(result[1]).toEqual({
      id: 'block-2',
      taskId: 'task-2',
      startsAt: '2026-09-24T11:00:00.000Z',
      endsAt: '2026-09-24T12:00:00.000Z',
      workMinutes: 60,
      typeName: 'Praca domowa',
      typeColor: '#10b981',
      typeEnergy: 2,
      notes: null,
    });
  });

  it('handles blocks without tasks or task_types using default fallbacks', async () => {
    const queryMock = createQueryMock([
      {
        id: 'block-recovery',
        task_id: null,
        starts_at: '2026-09-24T14:00:00.000Z',
        ends_at: '2026-09-24T15:00:00.000Z',
        work_minutes: 60,
        tasks: null,
      },
    ]);

    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    const result = await listUnclosedBlocks(mockSupabase, userId, now);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'block-recovery',
      taskId: null,
      startsAt: '2026-09-24T14:00:00.000Z',
      endsAt: '2026-09-24T15:00:00.000Z',
      workMinutes: 60,
      typeName: 'Zadanie',
      typeColor: '#94a3b8',
      typeEnergy: 0,
      notes: null,
    });
  });

  it('throws an error when query fails', async () => {
    const queryMock = createQueryMock(null, { message: 'Database connection error' });

    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    await expect(listUnclosedBlocks(mockSupabase, userId, now)).rejects.toThrow(
      'Błąd pobierania niezamkniętych bloków: Database connection error',
    );
  });
});

describe('queries: getBlockById', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const blockId = 'block-123';

  it('returns mapped BlockItem when block is found', async () => {
    const queryMock = createQueryMock({
      id: blockId,
      user_id: userId,
      task_id: 'task-1',
      starts_at: '2026-09-25T10:00:00.000Z',
      ends_at: '2026-09-25T11:00:00.000Z',
      work_minutes: 60,
      status: 'planned',
      source: 'manual',
      pinned: true,
      actual_minutes: null,
      closed_at: null,
      notified_at: null,
      created_at: '2026-09-25T08:00:00.000Z',
      updated_at: '2026-09-25T08:00:00.000Z',
    });

    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    const result = await getBlockById(mockSupabase, userId, blockId);

    expect(result).not.toBeNull();
    expect(result).toEqual({
      id: blockId,
      userId,
      taskId: 'task-1',
      startsAt: '2026-09-25T10:00:00.000Z',
      endsAt: '2026-09-25T11:00:00.000Z',
      workMinutes: 60,
      status: 'planned',
      source: 'manual',
      pinned: true,
      actualMinutes: null,
      closedAt: null,
      notifiedAt: null,
      createdAt: '2026-09-25T08:00:00.000Z',
      updatedAt: '2026-09-25T08:00:00.000Z',
    });
  });

  it('returns null when block does not exist or query fails', async () => {
    const queryMock = createQueryMock(null, { message: 'Row not found' });

    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    const result = await getBlockById(mockSupabase, userId, blockId);
    expect(result).toBeNull();
  });
});

describe('mutation-helpers: deleteOverlappingUnpinnedBlocks', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const startsAt = '2026-09-25T10:00:00.000Z';
  const endsAt = '2026-09-25T11:30:00.000Z';

  it('deletes overlapping unpinned planned blocks within interval', async () => {
    const queryMock = createQueryMock(null);

    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    await deleteOverlappingUnpinnedBlocks(mockSupabase, userId, startsAt, endsAt);

    expect(mockSupabase.from).toHaveBeenCalledWith('blocks');
    expect(queryMock.delete).toHaveBeenCalled();
    expect(queryMock.eq).toHaveBeenCalledWith('user_id', userId);
    expect(queryMock.eq).toHaveBeenCalledWith('status', 'planned');
    expect(queryMock.eq).toHaveBeenCalledWith('pinned', false);
    expect(queryMock.lt).toHaveBeenCalledWith('starts_at', endsAt);
    expect(queryMock.gt).toHaveBeenCalledWith('ends_at', startsAt);
  });

  it('excludes excludeBlockId when specified in options', async () => {
    const queryMock = createQueryMock(null);

    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    await deleteOverlappingUnpinnedBlocks(mockSupabase, userId, {
      startsAt,
      endsAt,
      excludeBlockId: 'block-keep',
    });

    expect(queryMock.neq).toHaveBeenCalledWith('id', 'block-keep');
  });

  it('throws an error when deletion fails', async () => {
    const queryMock = createQueryMock(null, { message: 'Foreign key lock error' });

    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    await expect(
      deleteOverlappingUnpinnedBlocks(mockSupabase, userId, startsAt, endsAt),
    ).rejects.toThrow('Błąd usuwania nachodzących bloków: Foreign key lock error');
  });
});

describe('mutation-helpers: calculateTaskPaceForTask', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const taskId = 'task-1';
  const typeId = 'type-1';

  it('returns default pace 1.0 when no historical blocks exist', async () => {
    const queryMock = createQueryMock([]);

    const mockSupabase = {
      from: vi.fn(() => queryMock),
    } as unknown as ServerSupabase;

    const pace = await calculateTaskPaceForTask(mockSupabase, userId, taskId, typeId);
    expect(pace).toBe(1.0);
  });

  it('calibrates pace from type history and task history', async () => {
    // Type has one block: work 60, actual 90 -> sample 1.5.
    // EMA(1.5, seed 1.0, alpha 0.2) = 0.2 * 1.5 + 0.8 * 1.0 = 1.1.
    // Task has one block: work 60, actual 60 -> sample 1.0.
    // taskPace(1.0, seed 1.1, alpha 0.5) = 0.5 * 1.0 + 0.5 * 1.1 = 1.05.
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn((cols: string) => {
          if (cols.includes('tasks!inner')) {
            // Type query
            return createQueryMock([
              {
                work_minutes: 60,
                actual_minutes: 90,
                closed_at: '2026-09-20T10:00:00Z',
              },
            ]);
          }
          // Task query
          return createQueryMock([
            {
              work_minutes: 60,
              actual_minutes: 60,
              closed_at: '2026-09-22T10:00:00Z',
            },
          ]);
        }),
      })),
    } as unknown as ServerSupabase;

    const pace = await calculateTaskPaceForTask(mockSupabase, userId, taskId, typeId);
    expect(pace).toBeCloseTo(1.05, 2);
  });
});

describe('mutation-helpers: dailyMetricsFromClosedBlocks', () => {
  it('aggregates done, missed, and meanPaceSample correctly', () => {
    const blocks = [
      { status: 'done' as const, work_minutes: 60, actual_minutes: 60, closed_at: '2026-09-20T10:00:00Z' },
      { status: 'done' as const, work_minutes: 60, actual_minutes: 90, closed_at: '2026-09-21T10:00:00Z' },
      { status: 'missed' as const, work_minutes: 60, actual_minutes: null, closed_at: '2026-09-22T10:00:00Z' },
    ];

    const metrics = dailyMetricsFromClosedBlocks(blocks);
    expect(metrics.done).toBe(2);
    expect(metrics.missed).toBe(1);
    // samples: 60/60 = 1.0, 90/60 = 1.5 -> mean = 1.25
    expect(metrics.meanPaceSample).toBeCloseTo(1.25, 2);
  });

  it('returns null meanPaceSample when there are no done blocks with actual_minutes', () => {
    const blocks = [
      { status: 'missed' as const, work_minutes: 60, actual_minutes: null, closed_at: '2026-09-22T10:00:00Z' },
    ];

    const metrics = dailyMetricsFromClosedBlocks(blocks);
    expect(metrics.done).toBe(0);
    expect(metrics.missed).toBe(1);
    expect(metrics.meanPaceSample).toBeNull();
  });
});

describe('mutation-helpers: evaluateDayLoadWarning', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const startsAt = '2026-09-25T10:00:00.000Z'; // Europe/Warsaw (+2) -> local date 2026-09-25

  it('returns hasWarning: false when day load is within effective limit', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return createQueryMock({
            timezone: 'Europe/Warsaw',
            daily_energy_limit: 20,
            reflection_level: 'standard',
          });
        }
        if (table === 'blocks') {
          return createQueryMock([
            {
              starts_at: '2026-09-25T08:00:00.000Z',
              ends_at: '2026-09-25T10:00:00.000Z', // 2 hours
              tasks: { task_types: { energy: 2 } }, // 4 points
            },
          ]);
        }
        if (table === 'weekly_reflections') {
          return createQueryMock({
            week_start: '2026-09-20',
            fatigue: 2,
            stress: 2,
            focus: 4,
            distractions: 2,
          });
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    // Existing: 2h * energy 2 = 4 points.
    // New block: 60 min * energy 3 = 3 points. Total: 7 <= 20.
    const result = await evaluateDayLoadWarning(mockSupabase, userId, startsAt, {
      durationMinutes: 60,
      energy: 3,
    });

    expect(result.hasWarning).toBe(false);
    expect(result.totalDayPoints).toBe(7);
    expect(result.effectiveLimit).toBe(20);
    expect(result.warning).toBeUndefined();
  });

  it('returns hasWarning: true and Polish message when day load exceeds effective limit', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return createQueryMock({
            timezone: 'Europe/Warsaw',
            daily_energy_limit: 20,
            reflection_level: 'standard',
          });
        }
        if (table === 'blocks') {
          return createQueryMock([
            {
              starts_at: '2026-09-25T06:00:00.000Z',
              ends_at: '2026-09-25T12:00:00.000Z', // 6 hours
              tasks: { task_types: { energy: 3 } }, // 18 points
            },
          ]);
        }
        if (table === 'weekly_reflections') {
          return createQueryMock({
            week_start: '2026-09-20',
            fatigue: 2,
            stress: 2,
            focus: 4,
            distractions: 2,
          });
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    // Existing: 6h * energy 3 = 18 points.
    // New block: 90 min * energy 3 = 4.5 points. Total: 22.5 > 20.
    const result = await evaluateDayLoadWarning(mockSupabase, userId, startsAt, {
      durationMinutes: 90,
      energy: 3,
    });

    expect(result.hasWarning).toBe(true);
    expect(result.totalDayPoints).toBe(22.5);
    expect(result.effectiveLimit).toBe(20);
    expect(result.warning).toBe(
      'Uwaga: obciążenie w tym dniu (22.5 pkt) przekracza Twój limit (20 pkt)',
    );
  });

  it('falls back to 7-day metrics when reflection is absent and lowers limit in stress mode', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return createQueryMock({
            timezone: 'Europe/Warsaw',
            daily_energy_limit: 20,
            reflection_level: 'basic', // basic forces fallback to daily metrics
          });
        }
        if (table === 'weekly_reflections') {
          return createQueryMock(null);
        }
        if (table === 'blocks') {
          return {
            select: vi.fn((cols: string) => {
              if (cols.includes('task_types')) {
                // Day blocks query
                return createQueryMock([]);
              }
              // 7-day closed blocks query
              return createQueryMock([
                { status: 'done', work_minutes: 60, actual_minutes: 60, closed_at: '2026-09-20T10:00:00Z' },
                { status: 'missed', work_minutes: 60, actual_minutes: null, closed_at: '2026-09-21T10:00:00Z' },
                { status: 'missed', work_minutes: 60, actual_minutes: null, closed_at: '2026-09-22T10:00:00Z' },
                { status: 'missed', work_minutes: 60, actual_minutes: null, closed_at: '2026-09-23T10:00:00Z' },
                { status: 'missed', work_minutes: 60, actual_minutes: null, closed_at: '2026-09-24T10:00:00Z' },
              ]);
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    // 1 done, 4 missed out of 5 blocks: completion = 1/5 = 0.2 < 0.5 -> fallback multiplier 0.85
    // Effective limit: round(20 * 0.85) = 17.
    // Existing day points: 0. New block: 120 min energy 3 = 6 points <= 17 -> hasWarning: false.
    const result = await evaluateDayLoadWarning(mockSupabase, userId, startsAt, {
      durationMinutes: 120,
      energy: 3,
    });

    expect(result.effectiveLimit).toBe(17);
    expect(result.totalDayPoints).toBe(6);
    expect(result.hasWarning).toBe(false);
  });
});
