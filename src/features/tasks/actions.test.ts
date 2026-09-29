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
import { cancelTask, completeTask, createTask, updateTask } from './actions';

describe('tasks actions: createTask', () => {
  const userId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  const typeId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
  const createdTaskId = 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(replanForUser).mockResolvedValue({ placed: 1, unscheduled: [] });
  });

  it('returns unauthorized when user is not logged in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await createTask({
      typeId,
      fixation: 'flexible',
      estimateMinutes: 60,
    });

    expect(result).toEqual({ ok: false, error: 'Sesja wygasła. Zaloguj się ponownie.' });
    expect(replanForUser).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns invalidInput when input schema validation fails', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    // Missing both typeId and newOneOffTypeName
    const result = await createTask({
      fixation: 'flexible',
      estimateMinutes: 60,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.typeId).toBeDefined();
    }
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('creates flexible task with estimate and triggers replanning', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const insertedTask: Record<string, unknown> = {};
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            insert: vi.fn((row: Record<string, unknown>) => {
              Object.assign(insertedTask, row);
              return {
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: createdTaskId },
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

    const result = await createTask({
      typeId,
      fixation: 'flexible',
      estimateMinutes: 90,
      priority: 1,
      notes: 'Ważna notatka',
    });

    expect(result).toEqual({ ok: true, data: { taskId: createdTaskId } });
    expect(insertedTask).toMatchObject({
      user_id: userId,
      type_id: typeId,
      fixation: 'flexible',
      estimate_minutes: 90,
      priority: 1,
      status: 'active',
      notes: 'Ważna notatka',
    });
    expect(replanForUser).toHaveBeenCalledWith(mockSupabase, userId, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('creates flexible idea task without estimate and does NOT trigger replanning', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: createdTaskId },
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

    const result = await createTask({
      typeId,
      fixation: 'flexible',
      notes: 'Pomysł bez czasu',
    });

    expect(result).toEqual({ ok: true, data: { taskId: createdTaskId } });
    expect(replanForUser).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('creates a new one-off type when newOneOffTypeName is provided', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    const oneOffTypeId = 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a';

    let insertedType: Record<string, unknown> | null = null;
    let insertedTask: Record<string, unknown> | null = null;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'task_types') {
          return {
            insert: vi.fn((row: Record<string, unknown>) => {
              insertedType = row;
              return {
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: oneOffTypeId },
                    error: null,
                  }),
                })),
              };
            }),
          };
        }
        if (table === 'tasks') {
          return {
            insert: vi.fn((row: Record<string, unknown>) => {
              insertedTask = row;
              return {
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: createdTaskId },
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

    const result = await createTask({
      newOneOffTypeName: 'Naprawa kranu',
      fixation: 'flexible',
      estimateMinutes: 45,
    });

    expect(result).toEqual({ ok: true, data: { taskId: createdTaskId } });
    expect(insertedType).toMatchObject({
      user_id: userId,
      name: 'Naprawa kranu',
      color: '#64748b',
      energy: 2,
      is_one_off: true,
      is_rest: false,
    });
    expect(insertedTask).toMatchObject({
      type_id: oneOffTypeId,
    });
  });

  it('handles unique constraint error 23505 when one-off type already exists', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'task_types') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: '23505', message: 'duplicate key value' },
                }),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await createTask({
      newOneOffTypeName: 'Już istnieje',
      fixation: 'flexible',
    });

    expect(result).toEqual({ ok: false, error: 'Typ o tej nazwie już istnieje' });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('returns generic error without leaking db message when one-off type creation fails with unexpected db error', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'task_types') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: '42P01', message: 'relation task_types does not exist' },
                }),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await createTask({
      newOneOffTypeName: 'Nowy',
      fixation: 'flexible',
    });

    expect(result).toEqual({ ok: false, error: 'Nie udało się utworzyć typu zadania' });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('creates hard task, deletes overlapping unpinned blocks, inserts manual block, and replans', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    let deleteFilterLt: string | null = null;
    let deleteFilterGt: string | null = null;
    let insertedBlock: Record<string, unknown> | null = null;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: createdTaskId },
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === 'blocks') {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    lt: vi.fn((field: string, val: string) => {
                      deleteFilterLt = val;
                      return {
                        gt: vi.fn((gField: string, gVal: string) => {
                          deleteFilterGt = gVal;
                          return Promise.resolve({ error: null });
                        }),
                      };
                    }),
                  })),
                })),
              })),
            })),
            insert: vi.fn((row: Record<string, unknown>) => {
              insertedBlock = row;
              return Promise.resolve({ error: null });
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await createTask({
      typeId,
      fixation: 'hard',
      date: '2026-10-15',
      startTime: '10:00',
      durationMinutes: 60,
      timeZone: 'Europe/Warsaw',
    });

    expect(result).toEqual({ ok: true, data: { taskId: createdTaskId } });
    expect(deleteFilterLt).toBeDefined();
    expect(deleteFilterGt).toBeDefined();
    expect(insertedBlock).toMatchObject({
      user_id: userId,
      task_id: createdTaskId,
      work_minutes: 60,
      status: 'planned',
      source: 'manual',
      pinned: true,
    });
    expect(replanForUser).toHaveBeenCalledWith(mockSupabase, userId, expect.any(Date));
  });

  it('handles exclusion constraint 23P01 when hard task overlaps with an existing pinned block', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    let deletedTaskId: string | null = null;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: createdTaskId },
                  error: null,
                }),
              })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn((field: string, val: string) => {
                deletedTaskId = val;
                return {
                  eq: vi.fn().mockResolvedValue({ error: null }),
                };
              }),
            })),
          };
        }
        if (table === 'blocks') {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    lt: vi.fn(() => ({
                      gt: vi.fn().mockResolvedValue({ error: null }),
                    })),
                  })),
                })),
              })),
            })),
            insert: vi.fn().mockResolvedValue({
              error: {
                code: '23P01',
                message: 'conflicting key value violates exclusion constraint "blocks_no_overlap"',
              },
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await createTask({
      typeId,
      fixation: 'hard',
      date: '2026-10-15',
      startTime: '10:00',
      durationMinutes: 60,
      timeZone: 'Europe/Warsaw',
    });

    expect(result).toEqual({ ok: false, error: 'W wybranym czasie istnieje już inne wydarzenie' });
    expect(deletedTaskId).toBe(createdTaskId);
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('handles concurrency error during replanning gracefully', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });
    vi.mocked(replanForUser).mockRejectedValue(new Error('Plan się zmienił, spróbuj ponownie'));

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: createdTaskId },
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

    const result = await createTask({
      typeId,
      fixation: 'flexible',
      estimateMinutes: 60,
    });

    expect(result).toEqual({ ok: false, error: 'Plan się zmienił, spróbuj ponownie' });
  });
});

describe('tasks actions: updateTask', () => {
  const userId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  const taskId = 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(replanForUser).mockResolvedValue({ placed: 1, unscheduled: [] });
  });

  it('returns unauthorized when user is not logged in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await updateTask({ taskId, priority: 1 });
    expect(result).toEqual({ ok: false, error: 'Sesja wygasła. Zaloguj się ponownie.' });
  });

  it('returns fail when task is not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      })),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await updateTask({ taskId, priority: 1 });
    expect(result).toEqual({ ok: false, error: 'Nie znaleziono zadania' });
  });

  it('updates task and replans when flexible task has an estimate', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    let updatedPayload: Record<string, unknown> | null = null;
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: taskId, fixation: 'flexible', estimate_minutes: 60 },
                error: null,
              }),
            })),
          })),
        })),
        update: vi.fn((row: Record<string, unknown>) => {
          updatedPayload = row;
          return {
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
          };
        }),
      })),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await updateTask({
      taskId,
      priority: 1,
      notes: 'Zaktualizowana notatka',
      estimateMinutes: 120,
    });

    expect(result).toEqual({ ok: true, data: { taskId } });
    expect(updatedPayload).toMatchObject({
      priority: 1,
      notes: 'Zaktualizowana notatka',
      estimate_minutes: 120,
    });
    expect(replanForUser).toHaveBeenCalledWith(mockSupabase, userId, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('returns generic error without leaking db message when update fails', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: taskId, fixation: 'flexible', estimate_minutes: 60 },
                error: null,
              }),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: { message: 'db_deadlock_detected' } }),
          })),
        })),
      })),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await updateTask({
      taskId,
      notes: 'Nowa',
    });

    expect(result).toEqual({ ok: false, error: 'Nie udało się zaktualizować zadania' });
    expect(replanForUser).not.toHaveBeenCalled();
  });
});

describe('tasks actions: completeTask and cancelTask', () => {
  const userId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  const taskId = 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f';
  const oneOffTypeId = 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(replanForUser).mockResolvedValue({ placed: 1, unscheduled: [] });
  });

  it('completes task, deletes future blocks, archives one-off type, and replans', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    let taskUpdated: Record<string, unknown> | null = null;
    let typeUpdated: Record<string, unknown> | null = null;
    let blocksDeleted = false;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: taskId,
                      status: 'active',
                      type_id: oneOffTypeId,
                      task_types: { id: oneOffTypeId, is_one_off: true },
                    },
                    error: null,
                  }),
                })),
              })),
            })),
            update: vi.fn((row: Record<string, unknown>) => {
              taskUpdated = row;
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                })),
              };
            }),
          };
        }
        if (table === 'blocks') {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    gt: vi.fn(() => {
                      blocksDeleted = true;
                      return Promise.resolve({ error: null });
                    }),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'task_types') {
          return {
            update: vi.fn((row: Record<string, unknown>) => {
              typeUpdated = row;
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                })),
              };
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await completeTask({ taskId });

    expect(result).toEqual({ ok: true, data: { success: true } });
    expect(taskUpdated).toMatchObject({
      status: 'done',
      completed_at: expect.any(String),
    });
    expect(blocksDeleted).toBe(true);
    expect(typeUpdated).toMatchObject({
      archived_at: expect.any(String),
    });
    expect(replanForUser).toHaveBeenCalledWith(mockSupabase, userId, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('cancels task, does NOT archive regular type, deletes future blocks, and replans', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    let taskUpdated: Record<string, unknown> | null = null;
    let typeUpdated = false;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: taskId,
                      status: 'active',
                      type_id: 'e5f6a7b8-c9d0-4e1f-9a2b-3c4d5e6f7a8b',
                      task_types: { id: 'e5f6a7b8-c9d0-4e1f-9a2b-3c4d5e6f7a8b', is_one_off: false },
                    },
                    error: null,
                  }),
                })),
              })),
            })),
            update: vi.fn((row: Record<string, unknown>) => {
              taskUpdated = row;
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                })),
              };
            }),
          };
        }
        if (table === 'blocks') {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    gt: vi.fn().mockResolvedValue({ error: null }),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'task_types') {
          return {
            update: vi.fn(() => {
              typeUpdated = true;
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                })),
              };
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await cancelTask({ taskId });

    expect(result).toEqual({ ok: true, data: { success: true } });
    expect(taskUpdated).toMatchObject({
      status: 'cancelled',
    });
    expect(typeUpdated).toBe(false);
    expect(replanForUser).toHaveBeenCalledWith(mockSupabase, userId, expect.any(Date));
    expect(revalidatePath).toHaveBeenCalledWith('/calendar');
  });

  it('returns generic error without leaking db message when status update fails', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: taskId,
                  status: 'active',
                  type_id: oneOffTypeId,
                  task_types: { id: oneOffTypeId, is_one_off: false },
                },
                error: null,
              }),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: { message: 'permission denied' } }),
          })),
        })),
      })),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await completeTask({ taskId });

    expect(result).toEqual({ ok: false, error: 'Nie udało się zaktualizować statusu zadania' });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('returns fail and does not replan when completeTask is called on an already done task', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: taskId,
                  status: 'done',
                  type_id: oneOffTypeId,
                  task_types: { id: oneOffTypeId, is_one_off: false },
                },
                error: null,
              }),
            })),
          })),
        })),
      })),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await completeTask({ taskId });

    expect(result).toEqual({ ok: false, error: 'Zadanie nie jest aktywne' });
    expect(replanForUser).not.toHaveBeenCalled();
  });

  it('returns fail and does not replan when cancelTask is called on an already cancelled task', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.com' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: taskId,
                  status: 'cancelled',
                  type_id: oneOffTypeId,
                  task_types: { id: oneOffTypeId, is_one_off: false },
                },
                error: null,
              }),
            })),
          })),
        })),
      })),
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const result = await cancelTask({ taskId });

    expect(result).toEqual({ ok: false, error: 'Zadanie nie jest aktywne' });
    expect(replanForUser).not.toHaveBeenCalled();
  });
});
