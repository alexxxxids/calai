import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { STARTER_TYPES, ensureStarterTypes } from './starter-types';

describe('STARTER_TYPES', () => {
  it('defines exactly 6 starter types according to FR-12', () => {
    expect(STARTER_TYPES).toHaveLength(6);
  });

  it('contains expected types with valid energies and colors', () => {
    const names = STARTER_TYPES.map((t) => t.name);
    expect(names).toEqual([
      'Nauka',
      'Szkoła',
      'Programowanie',
      'Sprzątanie',
      'Sport',
      'Odpoczynek',
    ]);

    for (const t of STARTER_TYPES) {
      expect(t.energy).toBeGreaterThanOrEqual(0);
      expect(t.energy).toBeLessThanOrEqual(3);
      expect(t.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('has exactly one rest type with energy 0', () => {
    const restTypes = STARTER_TYPES.filter((t) => t.is_rest);
    expect(restTypes).toHaveLength(1);
    expect(restTypes[0]?.name).toBe('Odpoczynek');
    expect(restTypes[0]?.energy).toBe(0);
  });
});

describe('ensureStarterTypes', () => {
  const userId = '00000000-0000-0000-0000-000000000001';

  it('inserts starter types when user has 0 task types', async () => {
    let insertedRows: unknown[] = [];

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'task_types') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
            insert: vi.fn((rows: unknown[]) => {
              insertedRows = rows;
              return Promise.resolve({ error: null });
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient<Database>;

    await ensureStarterTypes(mockSupabase, userId);

    expect(insertedRows).toHaveLength(6);
    expect(insertedRows[0]).toMatchObject({
      user_id: userId,
      name: 'Nauka',
      color: '#3b82f6',
      energy: 3,
      is_rest: false,
      is_one_off: false,
    });
  });

  it('does not insert when user already has task types', async () => {
    const insertFn = vi.fn();

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'task_types') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
            }),
            insert: insertFn,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient<Database>;

    await ensureStarterTypes(mockSupabase, userId);

    expect(insertFn).not.toHaveBeenCalled();
  });

  it('gracefully handles 23505 unique violation', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'task_types') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
            insert: vi.fn().mockResolvedValue({
              error: { code: '23505', message: 'duplicate key' },
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(ensureStarterTypes(mockSupabase, userId)).resolves.not.toThrow();
  });
});
