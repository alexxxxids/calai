import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { renderToStaticMarkup } from 'react-dom/server';
import { requireUser } from '@/lib/auth';
import { getProfile, type ProfileRow } from '@/features/profile/queries';
import { getReflectionState } from '@/features/reflection/queries';
import type { ReflectionState } from '@/features/reflection/types';
import type { ServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ReflectionPage, { metadata } from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT: ${url}`);
  }),
}));

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(),
}));

vi.mock('@/features/profile/queries', () => ({
  getProfile: vi.fn(),
}));

vi.mock('@/features/reflection/queries', () => ({
  getReflectionState: vi.fn(),
}));

const mockSupabase = { from: vi.fn() } as unknown as ServerSupabase;
const mockUser = { id: 'user-reflection-123', email: 'test@example.com' };

function createMockProfile(overrides?: Partial<ProfileRow>): ProfileRow {
  return {
    id: 'user-reflection-123',
    display_name: 'Test Użytkownik',
    timezone: 'Europe/Warsaw',
    day_start: '08:00:00',
    day_end: '20:00:00',
    daily_energy_limit: 10,
    reflection_level: 'analytic',
    onboarded_at: '2026-10-01T08:00:00.000Z',
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

function createMockState(reflectionLevel: 'basic' | 'analytic' | 'strategic'): ReflectionState {
  return {
    profile: {
      id: 'user-reflection-123',
      displayName: 'Test Użytkownik',
      timezone: 'Europe/Warsaw',
      reflectionLevel,
    },
    weekly:
      reflectionLevel === 'basic'
        ? null
        : {
            currentWeek: '2026-10-12',
            previousWeek: '2026-10-05',
            currentReflection: null,
            previousReflection: null,
          },
    monthly:
      reflectionLevel !== 'strategic'
        ? null
        : {
            currentMonth: '2026-10-01',
            previousMonth: '2026-09-01',
            currentReflection: null,
            previousReflection: null,
            currentStats: [],
            previousStats: [],
          },
  };
}

describe('ReflectionPage metadata', () => {
  it('should export expected title and description', () => {
    expect(metadata.title).toBe('Refleksja');
    expect(metadata.description).toContain('Tygodniowa samoocena');
  });
});

describe('ReflectionPage rendering and auth flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({ user: mockUser, supabase: mockSupabase });
  });

  it('should redirect to /onboarding when user has no profile', async () => {
    vi.mocked(getProfile).mockResolvedValue(null);

    await expect(ReflectionPage()).rejects.toThrow('NEXT_REDIRECT: /onboarding');

    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(getProfile).toHaveBeenCalledWith(mockSupabase, mockUser.id);
    expect(redirect).toHaveBeenCalledWith('/onboarding');
    expect(getReflectionState).not.toHaveBeenCalled();
  });

  it('should fetch reflection state and render page content for analytic user', async () => {
    const profile = createMockProfile({ reflection_level: 'analytic' });
    const state = createMockState('analytic');

    vi.mocked(getProfile).mockResolvedValue(profile);
    vi.mocked(getReflectionState).mockResolvedValue(state);

    const jsx = await ReflectionPage();
    const html = renderToStaticMarkup(jsx);

    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(getProfile).toHaveBeenCalledWith(mockSupabase, mockUser.id);
    expect(getReflectionState).toHaveBeenCalledWith(mockSupabase, mockUser.id, undefined, profile);

    expect(html).toContain('Refleksja');
    expect(html).toContain('Tygodniowa samoocena samopoczucia');
    expect(html).toContain('Tydzień');
    expect(html).toContain('Miesiąc');
    expect(html).toContain('Refleksja tygodniowa');
  });

  it('should render locked message for basic level user', async () => {
    const profile = createMockProfile({ reflection_level: 'basic' });
    const state = createMockState('basic');

    vi.mocked(getProfile).mockResolvedValue(profile);
    vi.mocked(getReflectionState).mockResolvedValue(state);

    const jsx = await ReflectionPage();
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain('Refleksja tygodniowa jest zablokowana');
  });
});
