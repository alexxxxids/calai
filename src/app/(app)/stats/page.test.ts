import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(),
}));
vi.mock('@/features/stats/queries', () => ({
  getStatsOverview: vi.fn(),
}));

import { renderToStaticMarkup } from 'react-dom/server';
import { requireUser, type CurrentUser } from '@/lib/auth';
import { getStatsOverview } from '@/features/stats/queries';
import type { StatsOverview } from '@/features/stats/types';
import type { ServerSupabase } from '@/lib/supabase/server';
import StatsPage, { metadata } from './page';

describe('StatsPage server component', () => {
  const mockSupabase = {} as ServerSupabase;
  const mockUser: CurrentUser = { id: 'test-user-123', email: 'test@example.com' };

  const mockOverview: StatsOverview = {
    range: 30,
    effectiveLimit: 20,
    reflectionLevel: 'strategic',
    typeStats: [
      {
        typeId: 't1',
        typeName: 'Nauka',
        color: '#f00',
        isOneOff: false,
        plannedMinutes: 120,
        actualMinutes: 100,
        doneBlocks: 2,
        missedBlocks: 0,
        completionRate: 100,
      },
    ],
    completionRate: {
      totalDone: 2,
      totalMissed: 0,
      totalClosed: 2,
      percentage: 100,
    },
    dailyLoad: [
      {
        date: '2026-10-22',
        points: 4,
        limit: 20,
        dayOfWeek: 4,
      },
    ],
    fatigueTrend: [
      {
        weekStart: '2026-10-12',
        fatigue: 3,
        stress: 2,
        focus: 4,
        distractions: 2,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({
      supabase: mockSupabase,
      user: mockUser,
    });
    vi.mocked(getStatsOverview).mockResolvedValue(mockOverview);
  });

  it('has correct page metadata', () => {
    expect(metadata.title).toBe('Statystyki');
    expect(metadata.description).toBeDefined();
  });

  it('renders stats view with default 30-day range when searchParams is empty', async () => {
    const pageElement = await StatsPage({
      searchParams: Promise.resolve({}),
    });

    expect(getStatsOverview).toHaveBeenCalledWith(mockSupabase, mockUser.id, 30);
    const html = renderToStaticMarkup(pageElement);
    expect(html).toContain('Statystyki');
    expect(html).toContain('Wskaźnik realizacji zadań');
    expect(html).toContain('Dzienny bilans obciążenia');
    expect(html).toContain('Trendy samopoczucia');
    expect(html).toContain('100%');
    expect(html).toContain('7 dni');
    expect(html).toContain('30 dni');
    expect(html).toContain('90 dni');
  });

  it('parses valid range parameter from searchParams', async () => {
    const pageElement = await StatsPage({
      searchParams: Promise.resolve({ range: '7' }),
    });

    expect(getStatsOverview).toHaveBeenCalledWith(mockSupabase, mockUser.id, 7);
    const html = renderToStaticMarkup(pageElement);
    expect(html).toContain('Statystyki');
  });
});
