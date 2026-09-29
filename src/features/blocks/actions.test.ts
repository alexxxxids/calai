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
import { closeBlock, deleteBlock, moveBlock, scheduleTaskBlock } from './actions';

interface QueryResult {
  readonly data: unknown;
  readonly error: { message?: string; code?: string } | null;
}

function createQueryMock(result: QueryResult) {
  const mock: Record<string, unknown> = {};
  const self = () => mock;

  mock.select = vi.fn(self);
  mock.insert = vi.fn(self);
  mock.update = vi.fn(self);
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
  mock.maybeSingle = vi.fn().mockResolvedValue(result);
  mock.single = vi.fn().mockResolvedValue(result);
  mock.then = (resolve: (val: QueryResult) => unknown, reject?: (err: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);

  return mock;
}

interface MockDbConfig {
  task?: { id: string; status: string; type_id: string; task_types?: { energy: number } | null } | null;
  taskError?: { message: string; code?: string } | null;
  plannedBlock?: {
    id: string;
    status: string;
    starts_at: string;
    ends_at: string;
    work_minutes: number;
    tasks?: { task_types?: { energy: number } | null } | null;
  } | null;
  plannedBlockError?: { message: string; code?: string } | null;
  insertedBlockId?: string;
  insertError?: { message: string; code?: string } | null;
  updateError?: { message: string; code?: string } | null;
  deleteError?: { message: string; code?: string } | null;
  profile?: { timezone: string; daily_energy_limit: number; reflection_level: string } | null;
  reflection?: {
    week_start: string;
    fatigue: number;
    stress: number;
    focus: number;
    distractions: number;
  } | null;
  typePaceRows?: { work_minutes: number; actual_minutes: number | null; closed_at: string | null }[];
  taskPaceRows?: { work_minutes: number; actual_minutes: number | null; closed_at: string | null }[];
  dayBlocks?: {
    starts_at: string;
    ends_at: string;
    tasks?: { task_types?: { energy: number } | null } | null;
  }[];
}

interface MockMutationTrackers {
  readonly deletedCalls: { table: string }[];
  readonly insertedRows: Record<string, unknown>[];
  readonly updatedRows: Record<string, unknown>[];
}

function resolveArraySelectData(cols: string, config: MockDbConfig): unknown[] | undefined {
  if (cols.includes('tasks!inner')) {
    return config.typePaceRows ?? [];
  }
  if (cols.includes('task_id')) {
    return config.taskPaceRows ?? [];
  }
  if (cols.includes('closed_at')) {
    return [];
  }
  if (cols.includes('task_types') && !cols.includes('work_minutes')) {
    return config.dayBlocks ?? [];
  }
  return undefined;
}

function resolveSelectData(cols: string, config: MockDbConfig): unknown {
  const arrayResult = resolveArraySelectData(cols, config);
  if (arrayResult !== undefined) {
    return arrayResult;
  }
  if (cols === 'id') {
    return config.plannedBlock ? [{ id: config.plannedBlock.id }] : [];
  }
  return config.plannedBlock ?? null;
}

function handleBlocksSelect(cols: string, config: MockDbConfig) {
  const data = resolveSelectData(cols, config);
  const error = config.plannedBlockError || null;
  return createQueryMock({ data, error });
}

function handleBlocksTable(config: MockDbConfig, trackers: MockMutationTrackers) {
  const queryMock = createQueryMock({ data: null, error: null });

  queryMock.insert = vi.fn((row: Record<string, unknown>) => {
    trackers.insertedRows.push(row);
    if (config.insertError) {
      return createQueryMock({ data: null, error: config.insertError });
    }
    const id = config.insertedBlockId ?? 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b';
    return createQueryMock({ data: { id }, error: null });
  });

  queryMock.update = vi.fn((row: Record<string, unknown>) => {
    trackers.updatedRows.push(row);
    if (config.updateError) {
      return createQueryMock({ data: null, error: config.updateError });
    }
    const updateResult = config.plannedBlock ? [{ id: config.plannedBlock.id }] : [];
    const updateMock = createQueryMock({ data: updateResult, error: null });
    updateMock.select = vi.fn((cols: string) => handleBlocksSelect(cols, config));
    return updateMock;
  });

  queryMock.delete = vi.fn(() => {
    trackers.deletedCalls.push({ table: 'blocks' });
    if (config.deleteError) {
      return createQueryMock({ data: null, error: config.deleteError });
    }
    const deleteResult = config.plannedBlock ? [{ id: config.plannedBlock.id }] : [];
    const deleteMock = createQueryMock({ data: deleteResult, error: null });
    deleteMock.select = vi.fn((cols: string) => handleBlocksSelect(cols, config));
    return deleteMock;
  });

  queryMock.select = vi.fn((cols: string) => handleBlocksSelect(cols, config));

  return queryMock;
}

function buildMockSupabase(config: MockDbConfig) {
  const deletedCalls: { table: string }[] = [];
  const insertedRows: Record<string, unknown>[] = [];
  const updatedRows: Record<string, unknown>[] = [];

  const mockClient = {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        const profileData =
          config.profile !== undefined
            ? config.profile
            : { timezone: 'Europe/Warsaw', daily_energy_limit: 20, reflection_level: 'standard' };
        return createQueryMock({ data: profileData, error: null });
      }

      if (table === 'weekly_reflections') {
        return createQueryMock({ data: config.reflection ?? null, error: null });
      }

      if (table === 'tasks') {
        return createQueryMock({
          data: config.task !== undefined ? config.task : null,
          error: config.taskError ?? null,
        });
      }

      if (table === 'blocks') {
        return handleBlocksTable(config, { deletedCalls, insertedRows, updatedRows });
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  } as unknown as ServerSupabase;

  return { mockClient, insertedRows, updatedRows, deletedCalls };
}

describe('blocks actions: scheduleTaskBlock', () => {
  const userId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  const taskId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
  const typeId = 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f';
  const validStart = '2026-09-25T10:00:00.000Z';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(replanForUser).mockResolvedValue({ placed: 1, unscheduled: [] });
  });

  it('returns unauthorized when user session is missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await scheduleTaskBlock({
      taskId,
      start: validStart,
      durationMinutes: 60,
    });

    expect(result).toEqual({ ok: false, error: 'Sesja wygasła. Zaloguj się ponownie.' });
    expect(replanForUser).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns invalidInput when duration is less than minimum', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const result = await scheduleTaskBlock({
      taskId,
      start: validStart,
      durationMinutes: 10, // min is 15
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.durationMinutes).toBeDefined();
    }
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('returns fail when task is not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({ task: null });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await scheduleTaskBlock({
      taskId,
      start: validStart,
      durationMinutes: 60,
    });

    expect(result).toEqual({ ok: false, error: 'Nie znaleziono zadania' });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('returns fail when task is not active', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({
      task: { id: taskId, status: 'done', type_id: typeId },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await scheduleTaskBlock({
      taskId,
      start: validStart,
      durationMinutes: 60,
    });

    expect(result).toEqual({ ok: false, error: 'Zadanie nie jest aktywne' });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('successfully schedules block from backlog with pace calculation, evicts unpinned blocks and replans', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient, insertedRows, deletedCalls } = buildMockSupabase({
      task: {
        id: taskId,
        status: 'active',
        type_id: typeId,
        task_types: { energy: 2 },
      },
      insertedBlockId: 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b',
      dayBlocks: [],
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await scheduleTaskBlock({
      taskId,
      start: validStart,
      durationMinutes: 60,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        blockId: 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b',
        warning: undefined,
      },
    });

    expect(deletedCalls.length).toBeGreaterThan(0);
    expect(insertedRows).toHaveLength(1);
    const [inserted] = insertedRows;
    expect(inserted).toBeDefined();
    expect(inserted).toEqual({
      task_id: taskId,
      starts_at: validStart,
      ends_at: '2026-09-25T11:00:00.000Z',
      work_minutes: 60,
      status: 'planned',
      source: 'manual',
      pinned: true,
    });
    // user_id is NOT in insert payload
    expect(inserted?.user_id).toBeUndefined();

    expect(replanForUser).toHaveBeenCalledWith(mockClient, userId, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('calculates work_minutes proportionally when task pace is different from 1.0', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    // Pace samples: 3 blocks with actual 90, work 60 -> sample 1.5
    const paceRows = [
      { work_minutes: 60, actual_minutes: 90, closed_at: '2026-09-24T10:00:00Z' },
      { work_minutes: 60, actual_minutes: 90, closed_at: '2026-09-24T12:00:00Z' },
      { work_minutes: 60, actual_minutes: 90, closed_at: '2026-09-24T14:00:00Z' },
    ];
    const { mockClient, insertedRows } = buildMockSupabase({
      task: {
        id: taskId,
        status: 'active',
        type_id: typeId,
        task_types: { energy: 2 },
      },
      typePaceRows: paceRows,
      taskPaceRows: paceRows,
      insertedBlockId: 'f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f7a8b9c',
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await scheduleTaskBlock({
      taskId,
      start: validStart,
      durationMinutes: 60,
    });

    expect(result.ok).toBe(true);
    // duration 60 / EMA pace 1.25 = 48 work minutes
    const [inserted] = insertedRows;
    expect(inserted).toBeDefined();
    expect(inserted?.work_minutes).toBe(48);
  });

  it('includes load warning when scheduling causes total day points to exceed limit', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({
      task: {
        id: taskId,
        status: 'active',
        type_id: typeId,
        task_types: { energy: 3 },
      },
      profile: {
        timezone: 'Europe/Warsaw',
        daily_energy_limit: 20,
        reflection_level: 'standard',
      },
      dayBlocks: [
        {
          starts_at: '2026-09-25T06:00:00.000Z',
          ends_at: '2026-09-25T12:00:00.000Z', // 6h * energy 3 = 18 pts
          tasks: { task_types: { energy: 3 } },
        },
      ],
      insertedBlockId: 'a7b8c9d0-e1f2-4a3b-8c4d-5e6f7a8b9c0d',
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    // New block: 90 min * energy 3 = 4.5 pts. Total = 18 + 4.5 = 22.5 > 20
    const result = await scheduleTaskBlock({
      taskId,
      start: validStart,
      durationMinutes: 90,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        blockId: 'a7b8c9d0-e1f2-4a3b-8c4d-5e6f7a8b9c0d',
        warning: 'Uwaga: obciążenie w tym dniu (22.5 pkt) przekracza Twój limit (20 pkt)',
      },
    });
  });

  it('handles exclusion violation error 23P01 from database cleanly', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({
      task: { id: taskId, status: 'active', type_id: typeId },
      insertError: { code: '23P01', message: 'conflicting key value violates exclusion constraint' },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await scheduleTaskBlock({
      taskId,
      start: validStart,
      durationMinutes: 60,
    });

    expect(result).toEqual({ ok: false, error: 'Ten termin jest zajęty' });
    expect(replanForUser).toHaveBeenCalledWith(mockClient, userId, expect.any(Date));
  });

  it('handles generic database error without leaking raw details', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({
      task: { id: taskId, status: 'active', type_id: typeId },
      insertError: { code: 'XX000', message: 'internal server error in postgres' },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await scheduleTaskBlock({
      taskId,
      start: validStart,
      durationMinutes: 60,
    });

    expect(result).toEqual({ ok: false, error: 'Nie udało się zaplanować bloku zadania' });
    expect(replanForUser).toHaveBeenCalledWith(mockClient, userId, expect.any(Date));
  });
});

describe('blocks actions: moveBlock', () => {
  const userId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  const blockId = 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a';
  const oldStart = '2026-09-25T10:00:00.000Z';
  const oldEnd = '2026-09-25T11:00:00.000Z'; // 60 min
  const newStart = '2026-09-25T14:00:00.000Z';
  const newEnd = '2026-09-25T16:00:00.000Z'; // 120 min

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(replanForUser).mockResolvedValue({ placed: 1, unscheduled: [] });
  });

  it('returns unauthorized when session is missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await moveBlock({
      blockId,
      start: newStart,
      end: newEnd,
    });

    expect(result).toEqual({ ok: false, error: 'Sesja wygasła. Zaloguj się ponownie.' });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('returns invalidInput when end is earlier than start', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const result = await moveBlock({
      blockId,
      start: newEnd,
      end: newStart,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.end).toBeDefined();
    }
  });

  it('returns fail when block is not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({ plannedBlock: null });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await moveBlock({
      blockId,
      start: newStart,
      end: newEnd,
    });

    expect(result).toEqual({ ok: false, error: 'Nie znaleziono bloku' });
  });

  it('returns fail when block status is not planned', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({
      plannedBlock: {
        id: blockId,
        status: 'done',
        starts_at: oldStart,
        ends_at: oldEnd,
        work_minutes: 60,
      },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await moveBlock({
      blockId,
      start: newStart,
      end: newEnd,
    });

    expect(result).toEqual({ ok: false, error: 'Można modyfikować tylko zaplanowane bloki' });
  });

  it('successfully moves, resizes with work scaling, pins block, replans and revalidates', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient, updatedRows, deletedCalls } = buildMockSupabase({
      plannedBlock: {
        id: blockId,
        status: 'planned',
        starts_at: oldStart,
        ends_at: oldEnd,
        work_minutes: 60,
        tasks: { task_types: { energy: 1 } },
      },
      dayBlocks: [],
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await moveBlock({
      blockId,
      start: newStart,
      end: newEnd,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        blockId,
        warning: undefined,
      },
    });

    expect(deletedCalls.length).toBeGreaterThan(0);
    expect(updatedRows).toHaveLength(1);
    const [updated] = updatedRows;
    expect(updated).toBeDefined();
    expect(updated).toEqual({
      starts_at: newStart,
      ends_at: newEnd,
      work_minutes: 120, // 60 min * 120 / 60 = 120
      pinned: true,
    });

    expect(replanForUser).toHaveBeenCalledWith(mockClient, userId, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('handles exclusion violation error 23P01 on move', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({
      plannedBlock: {
        id: blockId,
        status: 'planned',
        starts_at: oldStart,
        ends_at: oldEnd,
        work_minutes: 60,
      },
      updateError: { code: '23P01', message: 'exclusion violation' },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await moveBlock({
      blockId,
      start: newStart,
      end: newEnd,
    });

    expect(result).toEqual({ ok: false, error: 'Ten termin jest zajęty' });
    expect(replanForUser).toHaveBeenCalledWith(mockClient, userId, expect.any(Date));
  });
});

describe('blocks actions: closeBlock', () => {
  const userId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  const blockId = 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(replanForUser).mockResolvedValue({ placed: 0, unscheduled: [] });
  });

  it('returns unauthorized when session is missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await closeBlock({
      blockId,
      status: 'done',
      actualMinutes: 45,
    });

    expect(result).toEqual({ ok: false, error: 'Sesja wygasła. Zaloguj się ponownie.' });
  });

  it('returns invalidInput when actualMinutes is missing for status done', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const result = await closeBlock({
      blockId,
      status: 'done',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.actualMinutes).toBeDefined();
    }
  });

  it('returns fail when block is not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({ plannedBlock: null });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await closeBlock({
      blockId,
      status: 'done',
      actualMinutes: 45,
    });

    expect(result).toEqual({ ok: false, error: 'Nie znaleziono bloku' });
  });

  it('returns fail when block is already closed', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({
      plannedBlock: {
        id: blockId,
        status: 'done',
        starts_at: '2026-09-25T10:00:00Z',
        ends_at: '2026-09-25T11:00:00Z',
        work_minutes: 60,
      },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await closeBlock({
      blockId,
      status: 'done',
      actualMinutes: 45,
    });

    expect(result).toEqual({ ok: false, error: 'Ten blok został już zamknięty' });
  });

  it('successfully closes block as done with actualMinutes and replans', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient, updatedRows } = buildMockSupabase({
      plannedBlock: {
        id: blockId,
        status: 'planned',
        starts_at: '2026-09-25T10:00:00Z',
        ends_at: '2026-09-25T11:00:00Z',
        work_minutes: 60,
      },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await closeBlock({
      blockId,
      status: 'done',
      actualMinutes: 50,
    });

    expect(result).toEqual({ ok: true, data: { success: true } });
    expect(updatedRows).toHaveLength(1);
    const [updatedDone] = updatedRows;
    expect(updatedDone).toBeDefined();
    expect(updatedDone).toEqual({
      status: 'done',
      actual_minutes: 50,
      closed_at: expect.any(String),
    });
    expect(replanForUser).toHaveBeenCalledWith(mockClient, userId, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
    expect(revalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('successfully closes block as missed with actualMinutes null and replans', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient, updatedRows } = buildMockSupabase({
      plannedBlock: {
        id: blockId,
        status: 'planned',
        starts_at: '2026-09-25T10:00:00Z',
        ends_at: '2026-09-25T11:00:00Z',
        work_minutes: 60,
      },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await closeBlock({
      blockId,
      status: 'missed',
    });

    expect(result).toEqual({ ok: true, data: { success: true } });
    const [updatedMissed] = updatedRows;
    expect(updatedMissed).toBeDefined();
    expect(updatedMissed).toEqual({
      status: 'missed',
      actual_minutes: null,
      closed_at: expect.any(String),
    });
    expect(replanForUser).toHaveBeenCalledWith(mockClient, userId, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
    expect(revalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('returns fail when concurrent request already closed the block', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'blocks') {
          const queryMock = createQueryMock({ data: null, error: null });
          queryMock.select = vi.fn().mockReturnValue(createQueryMock({
            data: {
              id: blockId,
              status: 'planned',
              starts_at: '2026-09-25T10:00:00Z',
              ends_at: '2026-09-25T11:00:00Z',
              work_minutes: 60,
            },
            error: null,
          }));
          const updateMock: Record<string, unknown> = {};
          updateMock.eq = vi.fn().mockReturnValue(updateMock);
          updateMock.select = vi.fn().mockResolvedValue({ data: [], error: null });
          queryMock.update = vi.fn().mockReturnValue(updateMock);
          return queryMock;
        }
        return createQueryMock({ data: null, error: null });
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as unknown as ServerSupabase);

    const result = await closeBlock({
      blockId,
      status: 'done',
      actualMinutes: 45,
    });

    expect(result).toEqual({ ok: false, error: 'Ten blok został już zamknięty' });
    expect(replanForUser).not.toHaveBeenCalled();
  });
});

describe('blocks actions: deleteBlock', () => {
  const userId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  const blockId = 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(replanForUser).mockResolvedValue({ placed: 0, unscheduled: [] });
  });

  it('returns unauthorized when session is missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await deleteBlock({ blockId });

    expect(result).toEqual({ ok: false, error: 'Sesja wygasła. Zaloguj się ponownie.' });
  });

  it('returns invalidInput when blockId is not a valid UUID', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const result = await deleteBlock({ blockId: 'not-a-uuid' });

    expect(result.ok).toBe(false);
  });

  it('returns fail when block to delete is not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({ plannedBlock: null });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await deleteBlock({ blockId });

    expect(result).toEqual({ ok: false, error: 'Nie znaleziono bloku' });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('returns fail when attempting to delete a closed historical block', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient } = buildMockSupabase({
      plannedBlock: {
        id: blockId,
        status: 'done',
        starts_at: '2026-09-25T10:00:00Z',
        ends_at: '2026-09-25T11:00:00Z',
        work_minutes: 60,
      },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await deleteBlock({ blockId });

    expect(result).toEqual({ ok: false, error: 'Nie można usunąć zamkniętego bloku' });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('successfully deletes block, triggers replanning and revalidates path', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const { mockClient, deletedCalls } = buildMockSupabase({
      plannedBlock: {
        id: blockId,
        status: 'planned',
        starts_at: '2026-09-25T10:00:00Z',
        ends_at: '2026-09-25T11:00:00Z',
        work_minutes: 60,
      },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient);

    const result = await deleteBlock({ blockId });

    expect(result).toEqual({ ok: true, data: { success: true } });
    expect(deletedCalls.length).toBeGreaterThan(0);
    expect(replanForUser).toHaveBeenCalledWith(mockClient, userId, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
    expect(revalidatePath).toHaveBeenCalledWith('/tasks');
  });
});
