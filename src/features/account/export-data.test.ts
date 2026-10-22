import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { ServerSupabase } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';
import {
  buildUserExport,
  EXPORT_DATA_VERSION,
  exportUserData,
} from './export-data';

const ALL_EXPORT_TABLES = [
  'profiles',
  'task_types',
  'tasks',
  'blocks',
  'recurring_events',
  'habits',
  'habit_checks',
  'weekly_reflections',
  'monthly_reflections',
  'ai_requests',
  'push_subscriptions',
  'calendar_feeds',
  'calendar_subscriptions',
  'external_events',
] as const;

interface QueryCall {
  table: string;
  selectArg: string;
  eqArgs: [string, unknown];
  orderArgs: [string, unknown?];
}

function createMockSupabase(overrides?: {
  failingTable?: string;
  tableData?: Partial<Record<string, unknown[]>>;
}) {
  const calls: QueryCall[] = [];

  const client = {
    from: (table: string) => ({
      select: (selectArg: string) => ({
        eq: (col: string, val: unknown) => ({
          order: (orderCol: string, options?: unknown) => {
            calls.push({
              table,
              selectArg,
              eqArgs: [col, val],
              orderArgs: [orderCol, options],
            });

            if (overrides?.failingTable === table) {
              return Promise.resolve({
                data: null,
                error: { message: `Query failed on ${table}` },
              });
            }

            const data = overrides?.tableData?.[table] ?? [];
            return Promise.resolve({ data, error: null });
          },
        }),
      }),
    }),
  };

  return { mockSupabase: client as unknown as ServerSupabase, calls };
}

function assertTableFilter(
  calls: readonly QueryCall[],
  table: string,
  expectedCol: string,
  expectedValue: string
) {
  const call = calls.find((c) => c.table === table);
  expect(call).toBeDefined();
  expect(call?.selectArg).toBe('*');
  expect(call?.eqArgs).toEqual([expectedCol, expectedValue]);
}

function assertTableOrder(
  calls: readonly QueryCall[],
  table: string,
  expectedOrderCol: string
) {
  const call = calls.find((c) => c.table === table);
  expect(call?.orderArgs[0]).toBe(expectedOrderCol);
}

describe('buildUserExport', () => {
  it('creates an export structure with version 1 and deterministic metadata', () => {
    const fixedDate = '2026-10-22T20:00:00.000Z';
    const result = buildUserExport({}, 'user-test-1', fixedDate);

    expect(result.version).toBe(EXPORT_DATA_VERSION);
    expect(result.version).toBe(1);
    expect(result.exportedAt).toBe(fixedDate);
    expect(result.userId).toBe('user-test-1');
  });

  it('provides all 14 tables as empty arrays when given empty raw records', () => {
    const result = buildUserExport({}, 'user-test-empty');

    for (const table of ALL_EXPORT_TABLES) {
      expect(result[table]).toEqual([]);
    }
  });

  it('sorts rows deterministically by their primary sort key and fallback id', () => {
    const rawProfiles: Database['public']['Tables']['profiles']['Row'][] = [
      {
        id: 'user-b',
        display_name: 'B',
        timezone: 'UTC',
        day_start: '08:00',
        day_end: '22:00',
        reflection_level: 'basic',
        daily_energy_limit: 20,
        onboarded_at: null,
        created_at: '2026-10-02T10:00:00Z',
        updated_at: '2026-10-02T10:00:00Z',
      },
      {
        id: 'user-a',
        display_name: 'A',
        timezone: 'UTC',
        day_start: '08:00',
        day_end: '22:00',
        reflection_level: 'basic',
        daily_energy_limit: 20,
        onboarded_at: null,
        created_at: '2026-10-01T10:00:00Z',
        updated_at: '2026-10-01T10:00:00Z',
      },
    ];

    const rawBlocks: Database['public']['Tables']['blocks']['Row'][] = [
      {
        id: 'block-2',
        user_id: 'user-1',
        task_id: null,
        starts_at: '2026-10-22T14:00:00Z',
        ends_at: '2026-10-22T15:00:00Z',
        work_minutes: 60,
        status: 'planned',
        source: 'manual',
        pinned: false,
        notified_at: null,
        actual_minutes: null,
        closed_at: null,
        created_at: '2026-10-22T10:00:00Z',
        updated_at: '2026-10-22T10:00:00Z',
      },
      {
        id: 'block-1',
        user_id: 'user-1',
        task_id: null,
        starts_at: '2026-10-22T09:00:00Z',
        ends_at: '2026-10-22T10:00:00Z',
        work_minutes: 60,
        status: 'planned',
        source: 'manual',
        pinned: false,
        notified_at: null,
        actual_minutes: null,
        closed_at: null,
        created_at: '2026-10-22T08:00:00Z',
        updated_at: '2026-10-22T08:00:00Z',
      },
    ];

    const rawHabitChecks: Database['public']['Tables']['habit_checks']['Row'][] = [
      {
        user_id: 'user-1',
        habit_id: 'h-2',
        day: '2026-10-22',
        created_at: '2026-10-22T10:00:00Z',
      },
      {
        user_id: 'user-1',
        habit_id: 'h-1',
        day: '2026-10-21',
        created_at: '2026-10-21T10:00:00Z',
      },
    ];

    const result = buildUserExport(
      {
        profiles: rawProfiles,
        blocks: rawBlocks,
        habit_checks: rawHabitChecks,
      },
      'user-1'
    );

    expect(result.profiles.map((p) => p.id)).toEqual(['user-a', 'user-b']);
    expect(result.blocks.map((b) => b.id)).toEqual(['block-1', 'block-2']);
    expect(result.habit_checks.map((hc) => hc.day)).toEqual(['2026-10-21', '2026-10-22']);
  });
});

describe('exportUserData', () => {
  it('queries all 14 tables with correct user filter', async () => {
    const { mockSupabase, calls } = createMockSupabase();
    const userId = 'usr-uuid-456';

    const result = await exportUserData(mockSupabase, userId);

    expect(result.version).toBe(1);
    expect(result.userId).toBe(userId);
    expect(calls.length).toBe(14);

    const queriedTables = calls.map((c) => c.table).sort();
    expect(queriedTables).toEqual([...ALL_EXPORT_TABLES].sort());

    assertTableFilter(calls, 'profiles', 'id', userId);
    assertTableFilter(calls, 'task_types', 'user_id', userId);
    assertTableFilter(calls, 'tasks', 'user_id', userId);
    assertTableFilter(calls, 'blocks', 'user_id', userId);
    assertTableFilter(calls, 'recurring_events', 'user_id', userId);
    assertTableFilter(calls, 'habits', 'user_id', userId);
    assertTableFilter(calls, 'habit_checks', 'user_id', userId);
    assertTableFilter(calls, 'weekly_reflections', 'user_id', userId);
    assertTableFilter(calls, 'monthly_reflections', 'user_id', userId);
    assertTableFilter(calls, 'ai_requests', 'user_id', userId);
    assertTableFilter(calls, 'push_subscriptions', 'user_id', userId);
    assertTableFilter(calls, 'calendar_feeds', 'user_id', userId);
    assertTableFilter(calls, 'calendar_subscriptions', 'user_id', userId);
    assertTableFilter(calls, 'external_events', 'user_id', userId);
  });

  it('orders table queries with explicit sort columns', async () => {
    const { mockSupabase, calls } = createMockSupabase();
    await exportUserData(mockSupabase, 'usr-order-test');

    assertTableOrder(calls, 'profiles', 'id');
    assertTableOrder(calls, 'task_types', 'created_at');
    assertTableOrder(calls, 'tasks', 'created_at');
    assertTableOrder(calls, 'blocks', 'starts_at');
    assertTableOrder(calls, 'recurring_events', 'created_at');
    assertTableOrder(calls, 'habits', 'created_at');
    assertTableOrder(calls, 'habit_checks', 'day');
    assertTableOrder(calls, 'weekly_reflections', 'created_at');
    assertTableOrder(calls, 'monthly_reflections', 'created_at');
    assertTableOrder(calls, 'ai_requests', 'created_at');
    assertTableOrder(calls, 'push_subscriptions', 'created_at');
    assertTableOrder(calls, 'calendar_feeds', 'created_at');
    assertTableOrder(calls, 'calendar_subscriptions', 'created_at');
    assertTableOrder(calls, 'external_events', 'starts_at');
  });

  describe('error handling on query failure', () => {
    for (const failingTable of ALL_EXPORT_TABLES) {
      it(`throws explicit error when ${failingTable} query fails`, async () => {
        const { mockSupabase } = createMockSupabase({ failingTable });
        await expect(exportUserData(mockSupabase, 'user-err-test')).rejects.toThrow(
          `Nie udało się wyeksportować danych: ${failingTable}`
        );
      });
    }
  });
});
