import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { ServerSupabase } from '@/lib/supabase/server';

import {
  calculateTypePaces,
  filterAndSortBacklog,
  type RawBacklogTask,
} from './backlog-helpers';
import { getTaskById, listBacklog } from './queries';

describe('backlog-helpers: calculateTypePaces', () => {
  it('returns empty map when blocks list is empty', () => {
    const paces = calculateTypePaces([], [{ id: 'task-1', type_id: 'type-1' }]);
    expect(paces.size).toBe(0);
  });

  it('ignores ineligible blocks without task_id, actual_minutes, or invalid work_minutes', () => {
    const blocks = [
      { task_id: null, work_minutes: 60, actual_minutes: 60, closed_at: '2026-09-20T10:00:00Z' },
      { task_id: 'task-1', work_minutes: 0, actual_minutes: 60, closed_at: '2026-09-20T10:00:00Z' },
      { task_id: 'task-1', work_minutes: 60, actual_minutes: null, closed_at: '2026-09-20T10:00:00Z' },
      { task_id: 'task-1', work_minutes: 60, actual_minutes: 0, closed_at: '2026-09-20T10:00:00Z' },
      { task_id: 'task-1', work_minutes: 60, actual_minutes: 60, closed_at: null },
      { task_id: 'task-1', work_minutes: 60, actual_minutes: 60, closed_at: 'invalid-date' },
      { task_id: 'task-unknown', work_minutes: 60, actual_minutes: 60, closed_at: '2026-09-20T10:00:00Z' },
    ];
    const tasks = [{ id: 'task-1', type_id: 'type-1' }];

    const paces = calculateTypePaces(blocks, tasks);
    expect(paces.size).toBe(0);
  });

  it('calculates pace for task types from closed done blocks sorted chronologically', () => {
    const tasks = [
      { id: 'task-1', type_id: 'type-1' },
      { id: 'task-2', type_id: 'type-1' },
    ];
    // Block 1: 60 min work, 90 min actual -> sample 1.5
    // Block 2: 60 min work, 60 min actual -> sample 1.0
    const blocks = [
      { task_id: 'task-2', work_minutes: 60, actual_minutes: 60, closed_at: '2026-09-21T10:00:00Z' },
      { task_id: 'task-1', work_minutes: 60, actual_minutes: 90, closed_at: '2026-09-20T10:00:00Z' },
    ];

    const paces = calculateTypePaces(blocks, tasks);
    expect(paces.has('type-1')).toBe(true);
    // EMA with seed 1.0, alpha 0.2:
    // sample 1 (1.5): 0.2 * 1.5 + 0.8 * 1.0 = 1.1
    // sample 2 (1.0): 0.2 * 1.0 + 0.8 * 1.1 = 1.08
    expect(paces.get('type-1')).toBeCloseTo(1.08, 2);
  });
});

describe('backlog-helpers: filterAndSortBacklog', () => {
  const sampleTasks: RawBacklogTask[] = [
    {
      id: 'task-low-old',
      type_id: 'type-1',
      notes: 'Low priority old',
      priority: 3,
      fixation: 'flexible',
      estimate_minutes: 60,
      session_minutes: 60,
      deadline: null,
      created_at: '2026-09-01T10:00:00Z',
      task_types: { id: 'type-1', name: 'Nauka', color: '#3b82f6', energy: 2, is_one_off: false },
    },
    {
      id: 'task-high-old',
      type_id: 'type-1',
      notes: 'High priority old',
      priority: 1,
      fixation: 'flexible',
      estimate_minutes: 45,
      session_minutes: 45,
      deadline: null,
      created_at: '2026-09-01T12:00:00Z',
      task_types: { id: 'type-1', name: 'Nauka', color: '#3b82f6', energy: 2, is_one_off: false },
    },
    {
      id: 'task-high-new',
      type_id: 'type-2',
      notes: 'High priority new',
      priority: 1,
      fixation: 'flexible',
      estimate_minutes: null,
      session_minutes: null,
      deadline: null,
      created_at: '2026-09-02T10:00:00Z',
      task_types: { id: 'type-2', name: 'Projekt', color: '#10b981', energy: 3, is_one_off: true },
    },
    {
      id: 'task-med',
      type_id: 'type-1',
      notes: 'Med priority',
      priority: 2,
      fixation: 'flexible',
      estimate_minutes: 90,
      session_minutes: 90,
      deadline: null,
      created_at: '2026-09-02T08:00:00Z',
      task_types: { id: 'type-1', name: 'Nauka', color: '#3b82f6', energy: 2, is_one_off: false },
    },
  ];

  it('filters out tasks present in scheduledTaskIds set', () => {
    const scheduled = new Set(['task-high-old', 'task-med']);
    const typePaces = new Map([['type-1', 1.2]]);

    const result = filterAndSortBacklog(sampleTasks, scheduled, typePaces);
    expect(result.map((t) => t.id)).toEqual(['task-high-new', 'task-low-old']);
  });

  it('sorts backlog tasks by priority 1 -> 2 -> 3, then created_at desc', () => {
    const scheduled = new Set<string>();
    const typePaces = new Map([['type-1', 1.2], ['type-2', 1.5]]);

    const result = filterAndSortBacklog(sampleTasks, scheduled, typePaces);

    // Expected order:
    // 1. task-high-new (priority 1, created 2026-09-02)
    // 2. task-high-old (priority 1, created 2026-09-01)
    // 3. task-med (priority 2)
    // 4. task-low-old (priority 3)
    expect(result.map((t) => t.id)).toEqual([
      'task-high-new',
      'task-high-old',
      'task-med',
      'task-low-old',
    ]);
    expect(result[0]?.typePace).toBe(1.5);
    expect(result[1]?.typePace).toBe(1.2);
  });
});

describe('queries: listBacklog', () => {
  const userId = '00000000-0000-0000-0000-000000000001';

  function createMockSupabase(overrides?: {
    tasks?: { data: unknown; error: unknown };
    futureBlocks?: { data: unknown; error: unknown };
    doneBlocks?: { data: unknown; error: unknown };
    allTasks?: { data: unknown; error: unknown };
  }) {
    return {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn((fields: string) => {
              if (fields.includes('task_types')) {
                const res = overrides?.tasks ?? {
                  data: [
                    {
                      id: 't-1',
                      type_id: 'type-1',
                      notes: 'Aktywne zadanie bez bloku',
                      priority: 2,
                      fixation: 'flexible',
                      estimate_minutes: 60,
                      session_minutes: 60,
                      deadline: null,
                      created_at: '2026-09-25T10:00:00Z',
                      task_types: {
                        id: 'type-1',
                        name: 'Nauka',
                        color: '#3b82f6',
                        energy: 2,
                        is_one_off: false,
                      },
                    },
                    {
                      id: 't-2',
                      type_id: 'type-1',
                      notes: 'Zadanie z przyszłym blokiem',
                      priority: 1,
                      fixation: 'flexible',
                      estimate_minutes: 90,
                      session_minutes: 90,
                      deadline: null,
                      created_at: '2026-09-25T12:00:00Z',
                      task_types: {
                        id: 'type-1',
                        name: 'Nauka',
                        color: '#3b82f6',
                        energy: 2,
                        is_one_off: false,
                      },
                    },
                  ],
                  error: null,
                };
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue(res),
                  })),
                };
              }
              const allRes = overrides?.allTasks ?? {
                data: [{ id: 't-1', type_id: 'type-1' }, { id: 't-2', type_id: 'type-1' }],
                error: null,
              };
              return {
                eq: vi.fn().mockResolvedValue(allRes),
              };
            }),
          };
        }

        if (table === 'blocks') {
          return {
            select: vi.fn((fields: string) => {
              if (fields.includes('work_minutes')) {
                // Done blocks for pace
                const doneRes = overrides?.doneBlocks ?? {
                  data: [
                    {
                      task_id: 't-1',
                      work_minutes: 60,
                      actual_minutes: 72,
                      closed_at: '2026-09-20T10:00:00Z',
                    },
                  ],
                  error: null,
                };
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      not: vi.fn(() => ({
                        not: vi.fn(() => ({
                          not: vi.fn(() => ({
                            gt: vi.fn(() => ({
                              gt: vi.fn().mockResolvedValue(doneRes),
                            })),
                          })),
                        })),
                      })),
                    })),
                  })),
                };
              }

              // Future planned blocks
              const futureRes = overrides?.futureBlocks ?? {
                data: [{ task_id: 't-2' }],
                error: null,
              };
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    gt: vi.fn().mockResolvedValue(futureRes),
                  })),
                })),
              };
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;
  }

  it('excludes tasks with future planned blocks and attaches calculated pace', async () => {
    const supabase = createMockSupabase();

    const backlog = await listBacklog(supabase, userId, new Date('2026-09-25T08:00:00Z'));

    expect(backlog).toHaveLength(1);
    expect(backlog[0]?.id).toBe('t-1');
    expect(backlog[0]?.typeName).toBe('Nauka');
    expect(backlog[0]?.typePace).toBeCloseTo(1.04, 2);
  });

  it('throws an error if tasks query fails', async () => {
    const supabase = createMockSupabase({
      tasks: { data: null, error: { message: 'Database connection failed' } },
    });

    await expect(listBacklog(supabase, userId)).rejects.toThrow('Database connection failed');
  });

  it('excludes tasks with ongoing planned blocks by querying blocks ending after now', async () => {
    let filterColumn = '';
    let filterValue = '';

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn((fields: string) => {
              if (fields.includes('task_types!inner')) {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: 'task-ongoing',
                          type_id: 'type-1',
                          notes: null,
                          priority: 1,
                          fixation: 'flexible',
                          estimate_minutes: 60,
                          session_minutes: null,
                          deadline: null,
                          created_at: '2026-09-25T10:00:00Z',
                          task_types: { id: 'type-1', name: 'Nauka', color: '#3b82f6', energy: 2, is_one_off: false },
                        },
                      ],
                      error: null,
                    }),
                  })),
                };
              }
              return {
                eq: vi.fn().mockResolvedValue({ data: [{ id: 'task-ongoing', type_id: 'type-1' }], error: null }),
              };
            }),
          };
        }
        if (table === 'blocks') {
          return {
            select: vi.fn((fields: string) => {
              if (fields.includes('work_minutes')) {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      not: vi.fn(() => ({
                        not: vi.fn(() => ({
                          not: vi.fn(() => ({
                            gt: vi.fn(() => ({
                              gt: vi.fn().mockResolvedValue({ data: [], error: null }),
                            })),
                          })),
                        })),
                      })),
                    })),
                  })),
                };
              }
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    gt: vi.fn((col: string, val: string) => {
                      filterColumn = col;
                      filterValue = val;
                      return Promise.resolve({ data: [{ task_id: 'task-ongoing' }], error: null });
                    }),
                  })),
                })),
              };
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    const backlog = await listBacklog(mockSupabase, userId, new Date('2026-09-25T10:30:00Z'));

    expect(filterColumn).toBe('ends_at');
    expect(filterValue).toBe('2026-09-25T10:30:00.000Z');
    expect(backlog).toHaveLength(0);
  });
});

describe('queries: getTaskById', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const taskId = '11111111-1111-1111-1111-111111111111';

  it('returns mapped TaskWithDetails when task exists', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: taskId,
                  user_id: userId,
                  type_id: 'type-1',
                  notes: 'Test task notes',
                  priority: 2,
                  fixation: 'flexible',
                  estimate_minutes: 120,
                  session_minutes: 60,
                  deadline: '2026-10-01T18:00:00.000Z',
                  status: 'active',
                  completed_at: null,
                  created_at: '2026-09-25T10:00:00.000Z',
                  updated_at: '2026-09-25T10:00:00.000Z',
                  task_types: {
                    name: 'Nauka',
                    color: '#3b82f6',
                    energy: 2,
                    is_one_off: false,
                    is_rest: false,
                  },
                },
                error: null,
              }),
            })),
          })),
        })),
      })),
    } as unknown as ServerSupabase;

    const result = await getTaskById(mockSupabase, userId, taskId);

    expect(result).not.toBeNull();
    expect(result).toEqual({
      id: taskId,
      userId,
      typeId: 'type-1',
      typeName: 'Nauka',
      typeColor: '#3b82f6',
      typeEnergy: 2,
      isOneOff: false,
      isRest: false,
      priority: 2,
      fixation: 'flexible',
      notes: 'Test task notes',
      estimateMinutes: 120,
      sessionMinutes: 60,
      deadline: '2026-10-01T18:00:00.000Z',
      status: 'active',
      completedAt: null,
      createdAt: '2026-09-25T10:00:00.000Z',
      updatedAt: '2026-09-25T10:00:00.000Z',
    });
  });

  it('returns null when task is not found or query errors', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Row not found' },
              }),
            })),
          })),
        })),
      })),
    } as unknown as ServerSupabase;

    const result = await getTaskById(mockSupabase, userId, taskId);
    expect(result).toBeNull();
  });
});
