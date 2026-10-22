import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CurrentUser } from '@/lib/auth';
import type { UserExportData } from './export-data';

vi.mock('server-only', () => ({}));

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

const mockSupabase = { id: 'mock-supabase-client' };
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

const mockDeleteAccount = vi.fn();
vi.mock('./delete-account', () => ({
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}));

const mockExportUserData = vi.fn();
vi.mock('./export-data', () => ({
  exportUserData: (...args: unknown[]) => mockExportUserData(...args),
}));

import { deleteAccountAction, exportUserDataAction } from './actions';

describe('account Server Actions', () => {
  const sampleUser: CurrentUser = {
    id: 'user-0000-0000-0000-000000000001',
    email: 'user@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deleteAccountAction', () => {
    it('returns unauthorized when session is missing', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await deleteAccountAction({ confirmation: 'USUŃ' });

      expect(result).toEqual({
        ok: false,
        error: 'Sesja wygasła. Zaloguj się ponownie.',
      });
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it('delegates to deleteAccount when user is authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(sampleUser);
      mockDeleteAccount.mockResolvedValue({ ok: true, data: { success: true } });

      const input = { confirmation: 'USUŃ' };
      const result = await deleteAccountAction(input);

      expect(mockDeleteAccount).toHaveBeenCalledWith(mockSupabase, sampleUser, input);
      expect(result).toEqual({ ok: true, data: { success: true } });
    });

    it('returns failure result returned by deleteAccount', async () => {
      mockGetCurrentUser.mockResolvedValue(sampleUser);
      mockDeleteAccount.mockResolvedValue({
        ok: false,
        error: 'Popraw zaznaczone pola.',
        fieldErrors: { confirmation: ['Wpisz dokładnie „USUŃ”, aby potwierdzić usunięcie konta.'] },
      });

      const input = { confirmation: 'wrong' };
      const result = await deleteAccountAction(input);

      expect(mockDeleteAccount).toHaveBeenCalledWith(mockSupabase, sampleUser, input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Popraw zaznaczone pola.');
        expect(result.fieldErrors?.confirmation).toBeDefined();
      }
    });
  });

  describe('exportUserDataAction', () => {
    const sampleExportData: UserExportData = {
      version: 1,
      exportedAt: '2026-10-22T20:00:00.000Z',
      userId: sampleUser.id,
      profiles: [],
      task_types: [],
      tasks: [],
      blocks: [],
      recurring_events: [],
      habits: [],
      habit_checks: [],
      weekly_reflections: [],
      monthly_reflections: [],
      ai_requests: [],
      push_subscriptions: [],
      calendar_feeds: [],
      calendar_subscriptions: [],
      external_events: [],
    };

    it('returns unauthorized when session is missing', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await exportUserDataAction();

      expect(result).toEqual({
        ok: false,
        error: 'Sesja wygasła. Zaloguj się ponownie.',
      });
      expect(mockExportUserData).not.toHaveBeenCalled();
    });

    it('returns ok(data) when exportUserData succeeds', async () => {
      mockGetCurrentUser.mockResolvedValue(sampleUser);
      mockExportUserData.mockResolvedValue(sampleExportData);

      const result = await exportUserDataAction();

      expect(mockExportUserData).toHaveBeenCalledWith(mockSupabase, sampleUser.id);
      expect(result).toEqual({
        ok: true,
        data: sampleExportData,
      });
    });

    it('returns unexpected when exportUserData throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetCurrentUser.mockResolvedValue(sampleUser);
      const queryError = new Error('Database connection failed');
      mockExportUserData.mockRejectedValue(queryError);

      const result = await exportUserDataAction();

      expect(mockExportUserData).toHaveBeenCalledWith(mockSupabase, sampleUser.id);
      expect(result).toEqual({
        ok: false,
        error: 'Coś poszło nie tak. Spróbuj ponownie za chwilę.',
      });
      expect(consoleSpy).toHaveBeenCalledWith('[exportUserDataAction]', queryError);

      consoleSpy.mockRestore();
    });
  });
});
