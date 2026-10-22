import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/features/profile/queries', () => ({
  getProfile: vi.fn(),
}));

import { getProfile, type ProfileRow } from '@/features/profile/queries';
import { getReflectionState } from './queries';
import type { ServerSupabase } from '@/lib/supabase/server';

function createStrategicMockSupabase(
  weeklyRows: unknown[],
  monthlyRows: unknown[],
  rawTypeStats: unknown[],
): ServerSupabase {
  const tableData: Record<string, unknown[]> = {
    weekly_reflections: weeklyRows,
    monthly_reflections: monthlyRows,
  };

  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({
            data: tableData[table] ?? [],
            error: null,
          }),
        })),
      })),
    })),
    rpc: vi.fn().mockResolvedValue({
      data: rawTypeStats,
      error: null,
    }),
  } as unknown as ServerSupabase;
}

describe('features/reflection/queries', () => {
  const userId = 'user-test-1';
  const warsawTz = 'Europe/Warsaw';
  const fixedNow = new Date('2026-10-15T12:00:00Z'); // Thursday, current week: 2026-10-12, previous: 2026-10-05

  it('should throw an error when profile is not found', async () => {
    vi.mocked(getProfile).mockResolvedValue(null);
    const mockSupabase = {} as unknown as ServerSupabase;

    await expect(getReflectionState(mockSupabase, userId, fixedNow)).rejects.toThrow(
      'Nie znaleziono profilu użytkownika.',
    );
  });

  it('should return null for weekly and monthly state when level is basic', async () => {
    vi.mocked(getProfile).mockResolvedValue({
      id: userId,
      display_name: 'Jan',
      timezone: warsawTz,
      reflection_level: 'basic',
      daily_energy_limit: 20,
      day_start: '08:00:00',
      day_end: '22:00:00',
      onboarded_at: '2026-09-01T00:00:00Z',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    });

    const mockSupabase = {} as unknown as ServerSupabase;
    const state = await getReflectionState(mockSupabase, userId, fixedNow);

    expect(state.profile.reflectionLevel).toBe('basic');
    expect(state.weekly).toBeNull();
    expect(state.monthly).toBeNull();
  });

  it('should load weekly reflections and return null monthly state when level is analytic', async () => {
    vi.mocked(getProfile).mockResolvedValue({
      id: userId,
      display_name: 'Anna',
      timezone: warsawTz,
      reflection_level: 'analytic',
      daily_energy_limit: 20,
      day_start: '08:00:00',
      day_end: '22:00:00',
      onboarded_at: '2026-09-01T00:00:00Z',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    });

    const weeklyRowCurrent = {
      id: 'w-1',
      user_id: userId,
      week_start: '2026-10-12',
      fatigue: 2,
      stress: 3,
      focus: 4,
      distractions: 2,
      note: 'Dobry tydzień',
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    };

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'weekly_reflections') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn().mockResolvedValue({
                  data: [weeklyRowCurrent],
                  error: null,
                }),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ServerSupabase;

    const state = await getReflectionState(mockSupabase, userId, fixedNow);

    expect(state.profile.reflectionLevel).toBe('analytic');
    expect(state.weekly).not.toBeNull();
    expect(state.weekly?.currentWeek).toBe('2026-10-12');
    expect(state.weekly?.previousWeek).toBe('2026-10-05');
    expect(state.weekly?.currentReflection).toEqual(weeklyRowCurrent);
    expect(state.weekly?.previousReflection).toBeNull();
    expect(state.monthly).toBeNull();
  });

  it('should load both weekly and monthly reflections with type stats when level is strategic', async () => {
    const profile: ProfileRow = {
      id: userId,
      display_name: 'Piotr',
      timezone: warsawTz,
      reflection_level: 'strategic',
      daily_energy_limit: 20,
      day_start: '08:00:00',
      day_end: '22:00:00',
      onboarded_at: '2026-09-01T00:00:00Z',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    };
    vi.mocked(getProfile).mockResolvedValue(profile);

    const weeklyRowCurrent = {
      id: 'w-1',
      user_id: userId,
      week_start: '2026-10-12',
      fatigue: 1,
      stress: 2,
      focus: 5,
      distractions: 1,
      note: null,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    };

    const monthlyRowCurrent = {
      id: 'm-1',
      user_id: userId,
      month: '2026-10-01',
      went_well: 'Wszystko super',
      went_badly: null,
      types_review: 'OK',
      goals_next: 'Więcej sportu',
      priorities_change: null,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
    };

    const rawTypeStats = [
      {
        type_id: 't-1',
        type_name: 'Nauka',
        color: '#3b82f6',
        is_one_off: false,
        planned_minutes: 180,
        actual_minutes: 180,
        done_blocks: 3,
        missed_blocks: 0,
      },
      {
        type_id: 't-one-off',
        type_name: 'Dentysta',
        color: '#ef4444',
        is_one_off: true,
        planned_minutes: 60,
        actual_minutes: 60,
        done_blocks: 1,
        missed_blocks: 0,
      },
    ];

    const mockSupabase = createStrategicMockSupabase(
      [weeklyRowCurrent],
      [monthlyRowCurrent],
      rawTypeStats,
    );

    const state = await getReflectionState(mockSupabase, userId, fixedNow);

    expect(state.profile.reflectionLevel).toBe('strategic');
    expect(state.weekly).not.toBeNull();
    expect(state.monthly).not.toBeNull();

    const weekly = state.weekly!;
    const monthly = state.monthly!;

    expect(weekly.currentReflection).toEqual(weeklyRowCurrent);
    expect(monthly.currentReflection).toEqual(monthlyRowCurrent);
    expect(monthly.currentMonth).toBe('2026-10-01');
    expect(monthly.previousMonth).toBe('2026-09-01');

    // Check FR-21 aggregation in stats
    const currentStats = monthly.currentStats;
    expect(currentStats).toHaveLength(2);
    expect(currentStats[0]?.typeName).toBe('Nauka');
    expect(currentStats[1]?.typeName).toBe('Jednorazowe');
    expect(currentStats[1]?.isOneOff).toBe(true);
  });
});
