import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { ServerSupabase } from '@/lib/supabase/server';

import { loadPlannerData } from './queries';
import { replanForUser } from './replan';
import type { PlannerProfile, PlannerTaskRow, PlannerTaskType } from './types';

const BASE_PROFILE: PlannerProfile = {
  id: 'user-test-1',
  timezone: 'Europe/Warsaw',
  day_start: '08:00:00',
  day_end: '20:00:00',
  daily_energy_limit: 20,
  reflection_level: 'analytic',
};

const BASE_TASK_TYPES: readonly PlannerTaskType[] = [
  { id: 'type-study', name: 'Nauka', energy: 3, is_rest: false, is_one_off: false },
  { id: 'type-rest', name: 'Odpoczynek', energy: 0, is_rest: true, is_one_off: false },
];

const BASE_TASKS: readonly PlannerTaskRow[] = [
  {
    id: 'task-1',
    type_id: 'type-study',
    notes: 'Matematyka',
    priority: 2,
    fixation: 'flexible',
    estimate_minutes: 120,
    session_minutes: 60,
    deadline: null,
    created_at: '2026-10-10T10:00:00Z',
    status: 'active',
  },
];

interface MockTableResponses {
  profiles?: { data: unknown; error: { message: string } | null };
  task_types?: { data: unknown; error: { message: string } | null };
  tasks?: { data: unknown; error: { message: string } | null };
  blocks?: { data: unknown; error: { message: string } | null };
  recurring_events?: { data: unknown; error: { message: string } | null };
  calendar_subscriptions?: { data: unknown; error: { message: string } | null };
  external_events?: { data: unknown; error: { message: string } | null };
  weekly_reflections?: { data: unknown; error: { message: string } | null };
}

interface RpcCall {
  readonly name: string;
  readonly params: unknown;
}

function createMockQueryBuilder<T>(response: {
  data: T | null;
  error: { message: string } | null;
}) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    single: async () => response,
    maybeSingle: async () => response,
    then<TResult1 = typeof response, TResult2 = never>(
      onfulfilled?: ((value: typeof response) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(response).then(onfulfilled, onrejected);
    },
  };
  return builder;
}

function createMockSupabase(options: {
  tables?: MockTableResponses;
  rpcResponses?: Array<{ data: unknown; error: { code?: string; message: string } | null }>;
}) {
  const rpcCalls: RpcCall[] = [];
  let rpcIndex = 0;

  const defaultTables: MockTableResponses = {
    profiles: { data: BASE_PROFILE, error: null },
    task_types: { data: BASE_TASK_TYPES, error: null },
    tasks: { data: BASE_TASKS, error: null },
    blocks: { data: [], error: null },
    recurring_events: { data: [], error: null },
    calendar_subscriptions: { data: [], error: null },
    external_events: { data: [], error: null },
    weekly_reflections: { data: null, error: null },
  };

  const tables: MockTableResponses = { ...defaultTables, ...options.tables };

  const client = {
    from: (table: string) => {
      const response = tables[table as keyof MockTableResponses] ?? { data: [], error: null };
      return createMockQueryBuilder(response);
    },
    rpc: async (name: string, params: unknown) => {
      rpcCalls.push({ name, params });
      const response = options.rpcResponses?.[rpcIndex] ?? { data: 1, error: null };
      rpcIndex += 1;
      return response;
    },
  };

  // Mock ServerSupabase client for testing query and rpc flows
  return {
    client: client as unknown as ServerSupabase,
    rpcCalls,
  };
}

describe('loadPlannerData', () => {
  it('should load all 8 entities and assemble PlannerData on success', async () => {
    // Arrange
    const { client } = createMockSupabase({});

    // Act
    const data = await loadPlannerData(client, 'user-test-1');

    // Assert
    expect(data.profile.id).toBe('user-test-1');
    expect(data.profile.timezone).toBe('Europe/Warsaw');
    expect(data.taskTypes).toHaveLength(2);
    expect(data.tasks).toHaveLength(1);
    expect(data.blocks).toEqual([]);
    expect(data.recurringEvents).toEqual([]);
    expect(data.subscriptions).toEqual([]);
    expect(data.externalEvents).toEqual([]);
    expect(data.latestReflection).toBeNull();
  });

  it('should throw Polish error when profile is not found', async () => {
    // Arrange
    const { client } = createMockSupabase({
      tables: {
        profiles: { data: null, error: null },
      },
    });

    // Act & Assert
    await expect(loadPlannerData(client, 'user-test-1')).rejects.toThrow(
      'Nie znaleziono profilu użytkownika',
    );
  });

  it('should throw descriptive Polish error when profile query fails', async () => {
    // Arrange
    const { client } = createMockSupabase({
      tables: {
        profiles: { data: null, error: { message: 'Database connection failed' } },
      },
    });

    // Act & Assert
    await expect(loadPlannerData(client, 'user-test-1')).rejects.toThrow(
      'Błąd pobierania profilu: Database connection failed',
    );
  });

  it('should throw descriptive Polish error when task_types query fails', async () => {
    // Arrange
    const { client } = createMockSupabase({
      tables: {
        task_types: { data: null, error: { message: 'Query timeout' } },
      },
    });

    // Act & Assert
    await expect(loadPlannerData(client, 'user-test-1')).rejects.toThrow(
      'Błąd pobierania typów zadań: Query timeout',
    );
  });

  it('should throw descriptive Polish error when tasks query fails', async () => {
    // Arrange
    const { client } = createMockSupabase({
      tables: {
        tasks: { data: null, error: { message: 'Permission denied' } },
      },
    });

    // Act & Assert
    await expect(loadPlannerData(client, 'user-test-1')).rejects.toThrow(
      'Błąd pobierania zadań: Permission denied',
    );
  });

  it('should throw descriptive Polish error when blocks query fails', async () => {
    // Arrange
    const { client } = createMockSupabase({
      tables: {
        blocks: { data: null, error: { message: 'Disk full' } },
      },
    });

    // Act & Assert
    await expect(loadPlannerData(client, 'user-test-1')).rejects.toThrow(
      'Błąd pobierania bloków: Disk full',
    );
  });

  it('should throw descriptive Polish error when recurring_events query fails', async () => {
    // Arrange
    const { client } = createMockSupabase({
      tables: {
        recurring_events: { data: null, error: { message: 'Table corrupted' } },
      },
    });

    // Act & Assert
    await expect(loadPlannerData(client, 'user-test-1')).rejects.toThrow(
      'Błąd pobierania powtarzających się wydarzeń: Table corrupted',
    );
  });

  it('should throw descriptive Polish error when calendar_subscriptions query fails', async () => {
    // Arrange
    const { client } = createMockSupabase({
      tables: {
        calendar_subscriptions: { data: null, error: { message: 'Network error' } },
      },
    });

    // Act & Assert
    await expect(loadPlannerData(client, 'user-test-1')).rejects.toThrow(
      'Błąd pobierania subskrypcji kalendarza: Network error',
    );
  });

  it('should throw descriptive Polish error when external_events query fails', async () => {
    // Arrange
    const { client } = createMockSupabase({
      tables: {
        external_events: { data: null, error: { message: 'Serialization error' } },
      },
    });

    // Act & Assert
    await expect(loadPlannerData(client, 'user-test-1')).rejects.toThrow(
      'Błąd pobierania wydarzeń zewnętrznych: Serialization error',
    );
  });

  it('should throw descriptive Polish error when weekly_reflections query fails', async () => {
    // Arrange
    const { client } = createMockSupabase({
      tables: {
        weekly_reflections: { data: null, error: { message: 'Lock conflict' } },
      },
    });

    // Act & Assert
    await expect(loadPlannerData(client, 'user-test-1')).rejects.toThrow(
      'Błąd pobierania refleksji: Lock conflict',
    );
  });
});

describe('replanForUser', () => {
  it('should successfully compute schedule, call apply_plan rpc and return placed and unscheduled count', async () => {
    // Arrange
    const { client, rpcCalls } = createMockSupabase({
      rpcResponses: [{ data: 1, error: null }],
    });
    const now = new Date('2026-10-15T10:00:00Z');

    // Act
    const result = await replanForUser(client, 'user-test-1', now);

    // Assert
    expect(result.placed).toBeGreaterThanOrEqual(1);
    expect(result.unscheduled).toEqual([]);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.name).toBe('apply_plan');
    const params = rpcCalls[0]?.params as { p_remove_ids: string[]; p_new_blocks: unknown[] };
    expect(params.p_remove_ids).toBeDefined();
    expect(Array.isArray(params.p_new_blocks)).toBe(true);
    expect(params.p_new_blocks.length).toBe(result.placed);
  });

  it('should retry replanning once when concurrency conflict 23P01 occurs on first attempt', async () => {
    // Arrange: first call fails with 23P01, second call succeeds
    const { client, rpcCalls } = createMockSupabase({
      rpcResponses: [
        { data: null, error: { code: '23P01', message: 'Exclusion constraint violation' } },
        { data: 1, error: null },
      ],
    });
    const now = new Date('2026-10-15T10:00:00Z');

    // Act
    const result = await replanForUser(client, 'user-test-1', now);

    // Assert
    expect(result.placed).toBeGreaterThanOrEqual(1);
    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls[0]?.name).toBe('apply_plan');
    expect(rpcCalls[1]?.name).toBe('apply_plan');
  });

  it('should throw Polish error when concurrency conflict 23P01 occurs repeatedly on both attempts', async () => {
    // Arrange: both attempts fail with 23P01
    const { client, rpcCalls } = createMockSupabase({
      rpcResponses: [
        { data: null, error: { code: '23P01', message: 'Exclusion constraint violation' } },
        { data: null, error: { code: '23P01', message: 'Exclusion constraint violation' } },
      ],
    });
    const now = new Date('2026-10-15T10:00:00Z');

    // Act & Assert
    await expect(replanForUser(client, 'user-test-1', now)).rejects.toThrow(
      'Plan się zmienił, spróbuj ponownie',
    );
    expect(rpcCalls).toHaveLength(2);
  });

  it('should propagate unexpected database error without retrying', async () => {
    // Arrange: first call fails with non-concurrency error
    const { client, rpcCalls } = createMockSupabase({
      rpcResponses: [
        { data: null, error: { code: '42P01', message: 'relation blocks does not exist' } },
      ],
    });
    const now = new Date('2026-10-15T10:00:00Z');

    // Act & Assert
    await expect(replanForUser(client, 'user-test-1', now)).rejects.toThrow(
      'Błąd zapisu planu: relation blocks does not exist',
    );
    expect(rpcCalls).toHaveLength(1);
  });

  it('should throw when loadPlannerData fails during replanForUser', async () => {
    // Arrange
    const { client, rpcCalls } = createMockSupabase({
      tables: {
        profiles: { data: null, error: { message: 'Auth service down' } },
      },
    });
    const now = new Date('2026-10-15T10:00:00Z');

    // Act & Assert
    await expect(replanForUser(client, 'user-test-1', now)).rejects.toThrow(
      'Błąd pobierania profilu: Auth service down',
    );
    expect(rpcCalls).toHaveLength(0);
  });
});
