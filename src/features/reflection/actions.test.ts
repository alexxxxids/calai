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
vi.mock('@/features/profile/queries', () => ({
  getProfile: vi.fn(),
}));
vi.mock('@/features/planner', () => ({
  replanForUser: vi.fn(),
}));

import { createClient, type ServerSupabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { getProfile, type ProfileRow } from '@/features/profile/queries';
import { replanForUser } from '@/features/planner';
import { revalidatePath } from 'next/cache';
import { saveMonthlyReflection, saveWeeklyReflection } from './actions';

interface CapturedWeeklyPayload {
  readonly week_start?: string;
  readonly fatigue?: number;
  readonly stress?: number;
  readonly focus?: number;
  readonly distractions?: number;
  readonly note?: string | null;
  readonly updated_at?: string;
}

interface CapturedMonthlyPayload {
  readonly month?: string;
  readonly went_well?: string | null;
  readonly went_badly?: string | null;
  readonly types_review?: string | null;
  readonly goals_next?: string | null;
  readonly priorities_change?: string | null;
  readonly updated_at?: string;
}

describe('features/reflection/actions', () => {
  const userId = 'user-action-test';
  const warsawTz = 'Europe/Warsaw';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveWeeklyReflection', () => {
    it('should return invalidInput when payload fails Zod schema', async () => {
      const result = await saveWeeklyReflection({
        weekStart: 'invalid-date',
        fatigue: 99,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Popraw zaznaczone pola.');
        expect(result.fieldErrors).toBeDefined();
      }
    });

    it('should return unauthorized when user is not logged in', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      vi.mocked(createClient).mockResolvedValue({} as unknown as ServerSupabase);

      const result = await saveWeeklyReflection({
        weekStart: '2026-10-12',
        fatigue: 3,
        stress: 3,
        focus: 3,
        distractions: 3,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Sesja wygasła. Zaloguj się ponownie.');
      }
    });

    it('should return failure when user has basic reflection level (FR-11)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.pl' });
      vi.mocked(getProfile).mockResolvedValue({
        id: userId,
        timezone: warsawTz,
        reflection_level: 'basic',
      } as unknown as ProfileRow);
      vi.mocked(createClient).mockResolvedValue({} as unknown as ServerSupabase);

      const result = await saveWeeklyReflection({
        weekStart: '2026-10-12',
        fatigue: 3,
        stress: 3,
        focus: 3,
        distractions: 3,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Poziom refleksji nie pozwala na wypełnienie ankiety tygodniowej.');
      }
    });

    it('should return failure when weekStart is not current or previous week (FR-100)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.pl' });
      vi.mocked(getProfile).mockResolvedValue({
        id: userId,
        timezone: warsawTz,
        reflection_level: 'analytic',
      } as unknown as ProfileRow);
      vi.mocked(createClient).mockResolvedValue({} as unknown as ServerSupabase);

      // 2026-01-05 is way in the past
      const result = await saveWeeklyReflection({
        weekStart: '2026-01-05',
        fatigue: 3,
        stress: 3,
        focus: 3,
        distractions: 3,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Możesz zapisać refleksję tylko za bieżący lub poprzedni tydzień.');
      }
    });

    it('should successfully upsert weekly reflection, run replan and revalidate paths (FR-62)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));

      try {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.pl' });
        vi.mocked(getProfile).mockResolvedValue({
          id: userId,
          timezone: warsawTz,
          reflection_level: 'analytic',
        } as unknown as ProfileRow);

        let capturedPayload: CapturedWeeklyPayload | undefined;
        let capturedOptions: Record<string, unknown> | undefined;
        const mockSupabase = {
          from: vi.fn((table: string) => {
            if (table === 'weekly_reflections') {
              return {
                upsert: vi.fn((payload: CapturedWeeklyPayload, options: Record<string, unknown>) => {
                  capturedPayload = payload;
                  capturedOptions = options;
                  return Promise.resolve({ error: null });
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ServerSupabase);
        vi.mocked(replanForUser).mockResolvedValue({ placed: 2, unscheduled: [] });

        const result = await saveWeeklyReflection({
          weekStart: '2026-10-12',
          fatigue: 2,
          stress: 3,
          focus: 4,
          distractions: 1,
          note: 'Wszystko zgodnie z planem',
        });

        expect(result).toEqual({ ok: true, data: { weekStart: '2026-10-12' } });

        // Verify that user_id is omitted from upsert payload (Postgres default auth.uid())
        expect(capturedPayload).toBeDefined();
        expect(capturedPayload).not.toHaveProperty('user_id');
        expect(capturedPayload).toMatchObject({
          week_start: '2026-10-12',
          fatigue: 2,
          stress: 3,
          focus: 4,
          distractions: 1,
          note: 'Wszystko zgodnie z planem',
        });
        expect(capturedOptions).toEqual({ onConflict: 'user_id,week_start' });

        expect(replanForUser).toHaveBeenCalledWith(mockSupabase, userId, expect.any(Date));
        expect(revalidatePath).toHaveBeenCalledWith('/reflection');
        expect(revalidatePath).toHaveBeenCalledWith('/calendar');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should catch replan schedule conflict and return Polish failure message', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));

      try {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.pl' });
        vi.mocked(getProfile).mockResolvedValue({
          id: userId,
          timezone: warsawTz,
          reflection_level: 'strategic',
        } as unknown as ProfileRow);

        const mockSupabase = {
          from: vi.fn(() => ({
            upsert: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ServerSupabase);
        vi.mocked(replanForUser).mockRejectedValue(new Error('Plan się zmienił, spróbuj ponownie'));

        const result = await saveWeeklyReflection({
          weekStart: '2026-10-12',
          fatigue: 3,
          stress: 3,
          focus: 3,
          distractions: 3,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBe('Plan się zmienił, spróbuj ponownie');
        }
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('saveMonthlyReflection', () => {
    it('should return failure when level is not strategic (FR-11, FR-101)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.pl' });
      vi.mocked(getProfile).mockResolvedValue({
        id: userId,
        timezone: warsawTz,
        reflection_level: 'analytic',
      } as unknown as ProfileRow);
      vi.mocked(createClient).mockResolvedValue({} as unknown as ServerSupabase);

      const result = await saveMonthlyReflection({
        month: '2026-10-01',
        wentWell: 'Super',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Poziom refleksji nie pozwala na wypełnienie podsumowania miesięcznego.');
      }
    });

    it('should return failure when month is in the future', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));

      try {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.pl' });
        vi.mocked(getProfile).mockResolvedValue({
          id: userId,
          timezone: warsawTz,
          reflection_level: 'strategic',
        } as unknown as ProfileRow);
        vi.mocked(createClient).mockResolvedValue({} as unknown as ServerSupabase);

        const result = await saveMonthlyReflection({
          month: '2026-11-01',
          wentWell: 'Przyszłość',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBe('Nieprawidłowy miesiąc.');
        }
      } finally {
        vi.useRealTimers();
      }
    });

    it('should successfully upsert monthly reflection without user_id and revalidate /reflection', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));

      try {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: userId, email: 'test@example.pl' });
        vi.mocked(getProfile).mockResolvedValue({
          id: userId,
          timezone: warsawTz,
          reflection_level: 'strategic',
        } as unknown as ProfileRow);

        let capturedPayload: CapturedMonthlyPayload | undefined;
        let capturedOptions: Record<string, unknown> | undefined;
        const mockSupabase = {
          from: vi.fn((table: string) => {
            if (table === 'monthly_reflections') {
              return {
                upsert: vi.fn((payload: CapturedMonthlyPayload, options: Record<string, unknown>) => {
                  capturedPayload = payload;
                  capturedOptions = options;
                  return Promise.resolve({ error: null });
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ServerSupabase);

        const result = await saveMonthlyReflection({
          month: '2026-10-01',
          wentWell: 'Opanowanie Next.js 16',
          wentBadly: 'Mogło być więcej przerw',
          typesReview: 'Typy zadań dobrze zbalansowane',
          goalsNext: 'Dokończyć projekt szkolny',
          prioritiesChange: 'Więcej czasu na przygotowanie obrony',
        });

        expect(result).toEqual({ ok: true, data: { month: '2026-10-01' } });
        expect(capturedPayload).toBeDefined();
        expect(capturedPayload).not.toHaveProperty('user_id');
        expect(capturedPayload).toMatchObject({
          month: '2026-10-01',
          went_well: 'Opanowanie Next.js 16',
          went_badly: 'Mogło być więcej przerw',
          types_review: 'Typy zadań dobrze zbalansowane',
          goals_next: 'Dokończyć projekt szkolny',
          priorities_change: 'Więcej czasu na przygotowanie obrony',
        });
        expect(capturedOptions).toEqual({ onConflict: 'user_id,month' });

        expect(revalidatePath).toHaveBeenCalledWith('/reflection');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
