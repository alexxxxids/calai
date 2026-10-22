import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/features/profile/queries', () => ({
  getProfile: vi.fn(),
}));

import { getProfile, type ProfileRow } from '@/features/profile/queries';
import type { ServerSupabase } from '@/lib/supabase/server';
import {
  getDailyLoad,
  getFatigueTrend,
  getStatsOverview,
  getTypeStats,
} from './queries';
import { STATS_RANGE_30_DAYS, STATS_RANGE_7_DAYS } from './types';

describe('features/stats/queries', () => {
  const userId = 'test-user-123';
  const warsawTz = 'Europe/Warsaw';
  const fixedNow = new Date('2026-10-22T10:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTypeStats', () => {
    it('calls type_stats RPC and returns aggregated items', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            type_id: 't1',
            type_name: 'Nauka',
            color: '#123456',
            is_one_off: false,
            planned_minutes: 120,
            actual_minutes: 100,
            done_blocks: 2,
            missed_blocks: 0,
          },
          {
            type_id: 't2',
            type_name: 'Zadanie jednorazowe',
            color: '#abcdef',
            is_one_off: true,
            planned_minutes: 60,
            actual_minutes: 60,
            done_blocks: 1,
            missed_blocks: 0,
          },
        ],
        error: null,
      });

      const mockSupabase = {
        rpc: mockRpc,
      } as unknown as ServerSupabase;

      const result = await getTypeStats(
        mockSupabase,
        '2026-10-15T22:00:00.000Z',
        '2026-10-22T22:00:00.000Z',
      );

      expect(mockRpc).toHaveBeenCalledWith('type_stats', {
        p_from: '2026-10-15T22:00:00.000Z',
        p_to: '2026-10-22T22:00:00.000Z',
      });
      expect(result).toHaveLength(2);
      expect(result[0]?.typeName).toBe('Nauka');
      expect(result[1]?.typeName).toBe('Jednorazowe');
    });

    it('throws error when RPC fails', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('RPC failure'),
      });

      const mockSupabase = { rpc: mockRpc } as unknown as ServerSupabase;

      await expect(
        getTypeStats(mockSupabase, '2026-10-15T00:00:00Z', '2026-10-22T00:00:00Z'),
      ).rejects.toThrow('RPC failure');
    });
  });

  describe('getDailyLoad', () => {
    it('fetches non-missed blocks and calculates load per day', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({
                data: [
                  {
                    starts_at: '2026-10-22T08:00:00Z',
                    ends_at: '2026-10-22T09:00:00Z',
                    status: 'done',
                    actual_minutes: 60,
                    tasks: { task_types: { energy: 2 } },
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({ select: mockSelect }),
      } as unknown as ServerSupabase;

      const result = await getDailyLoad({
        supabase: mockSupabase,
        userId,
        fromIso: '2026-10-15T22:00:00.000Z',
        toIso: '2026-10-22T22:00:00.000Z',
        timeZone: warsawTz,
        rangeDays: STATS_RANGE_7_DAYS,
        now: fixedNow,
        effectiveLimit: 20,
      });

      expect(result).toHaveLength(7);
      const today = result.find((item) => item.date === '2026-10-22');
      expect(today?.points).toBe(2);
      expect(today?.limit).toBe(20);
    });

    it('throws error when database query fails', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({
                data: null,
                error: new Error('Database select error'),
              }),
            }),
          }),
        }),
      });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({ select: mockSelect }),
      } as unknown as ServerSupabase;

      await expect(
        getDailyLoad({
          supabase: mockSupabase,
          userId,
          fromIso: '2026-10-15T22:00:00.000Z',
          toIso: '2026-10-22T22:00:00.000Z',
          timeZone: warsawTz,
          rangeDays: STATS_RANGE_7_DAYS,
          now: fixedNow,
          effectiveLimit: 20,
        }),
      ).rejects.toThrow('Database select error');
    });
  });

  describe('getFatigueTrend', () => {
    it('queries weekly reflections with limit and sorts chronologically', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [
          // Supabase returns in descending order
          {
            week_start: '2026-10-12',
            fatigue: 4,
            stress: 3,
            focus: 3,
            distractions: 2,
          },
          {
            week_start: '2026-10-05',
            fatigue: 2,
            stress: 2,
            focus: 4,
            distractions: 1,
          },
        ],
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const mockSupabase = { from: mockFrom } as unknown as ServerSupabase;

      const result = await getFatigueTrend(mockSupabase, userId);

      expect(mockFrom).toHaveBeenCalledWith('weekly_reflections');
      expect(mockOrder).toHaveBeenCalledWith('week_start', { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(12);

      // formatFatigueTrend sorts chronologically (ascending)
      expect(result).toHaveLength(2);
      expect(result[0]?.weekStart).toBe('2026-10-05');
      expect(result[1]?.weekStart).toBe('2026-10-12');
    });

    it('throws error when weekly reflections query fails', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Reflections error'),
      });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const mockSupabase = { from: mockFrom } as unknown as ServerSupabase;

      await expect(getFatigueTrend(mockSupabase, userId)).rejects.toThrow('Reflections error');
    });
  });

  describe('getStatsOverview', () => {
    it('throws error if user profile is not found', async () => {
      vi.mocked(getProfile).mockResolvedValue(null);
      const mockSupabase = {} as unknown as ServerSupabase;

      await expect(
        getStatsOverview(mockSupabase, userId, STATS_RANGE_30_DAYS, fixedNow),
      ).rejects.toThrow('Nie znaleziono profilu użytkownika');
    });

    it('loads full overview data in parallel and returns StatsOverview object', async () => {
      const mockProfile: ProfileRow = {
        id: userId,
        timezone: warsawTz,
        daily_energy_limit: 25,
        reflection_level: 'strategic',
        display_name: 'Jan Kowalski',
        day_start: '08:00:00',
        day_end: '22:00:00',
        onboarded_at: '2026-09-01T00:00:00Z',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      };
      vi.mocked(getProfile).mockResolvedValue(mockProfile);

      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            type_id: 't1',
            type_name: 'Praca',
            color: '#111',
            is_one_off: false,
            planned_minutes: 180,
            actual_minutes: 180,
            done_blocks: 3,
            missed_blocks: 0,
          },
        ],
        error: null,
      });

      const mockBlocksSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      const mockReflectionsLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockFrom = vi.fn((table: string) => {
        if (table === 'blocks') {
          return { select: mockBlocksSelect };
        }
        if (table === 'weekly_reflections') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: mockReflectionsLimit,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const mockSupabase = {
        rpc: mockRpc,
        from: mockFrom,
      } as unknown as ServerSupabase;

      const overview = await getStatsOverview(
        mockSupabase,
        userId,
        STATS_RANGE_7_DAYS,
        fixedNow,
      );

      expect(overview.range).toBe(STATS_RANGE_7_DAYS);
      expect(overview.effectiveLimit).toBe(25);
      expect(overview.reflectionLevel).toBe('strategic');
      expect(overview.typeStats).toHaveLength(1);
      expect(overview.typeStats[0]?.typeName).toBe('Praca');
      expect(overview.completionRate.percentage).toBe(100);
      expect(overview.dailyLoad).toHaveLength(7);
      expect(overview.fatigueTrend).toHaveLength(0);
    });
  });
});
