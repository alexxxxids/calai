import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

const mockSyncSubscription = vi.fn();
vi.mock('./sync-subscription', () => ({
  syncSubscription: (...args: unknown[]) => mockSyncSubscription(...args),
}));

const mockReplanForUser = vi.fn().mockResolvedValue({ status: 'ok', blocksCreated: 0 });
vi.mock('@/features/planner/replan', () => ({
  replanForUser: (...args: unknown[]) => mockReplanForUser(...args),
}));

let mockSupabaseClient: unknown;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

import {
  addSubscription,
  removeSubscription,
  syncSubscriptionAction,
} from './actions';
import { listCalendarSubscriptions } from './queries';

describe('features/calendar-sync queries & actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listCalendarSubscriptions', () => {
    it('returns mapped subscriptions with task type details', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'sub-1',
                name: 'Studia',
                url: 'https://example.com/cal.ics',
                type_id: 'type-1',
                last_synced_at: '2026-10-22T10:00:00Z',
                last_error: null,
                created_at: '2026-10-20T10:00:00Z',
                task_types: { name: 'Edukacja', color: '#3b82f6' },
              },
            ],
            error: null,
          }),
        }),
      } as unknown as Parameters<typeof listCalendarSubscriptions>[0];

      const result = await listCalendarSubscriptions(mockSupabase, 'user-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'sub-1',
        name: 'Studia',
        url: 'https://example.com/cal.ics',
        typeId: 'type-1',
        typeName: 'Edukacja',
        typeColor: '#3b82f6',
        lastSyncedAt: '2026-10-22T10:00:00Z',
        lastError: null,
        createdAt: '2026-10-20T10:00:00Z',
      });
    });

    it('returns empty array when data is null', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as unknown as Parameters<typeof listCalendarSubscriptions>[0];

      const result = await listCalendarSubscriptions(mockSupabase, 'user-1');
      expect(result).toEqual([]);
    });

    it('throws error when database query fails', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB down' } }),
        }),
      } as unknown as Parameters<typeof listCalendarSubscriptions>[0];

      await expect(listCalendarSubscriptions(mockSupabase, 'user-1')).rejects.toThrow('DB down');
    });
  });

  describe('addSubscription action', () => {
    it('returns unauthorized when user is not signed in', async () => {
      mockGetCurrentUser.mockResolvedValueOnce(null);
      mockSupabaseClient = {} as unknown as SupabaseClient<Database>;

      const result = await addSubscription({
        name: 'Test',
        url: 'https://example.com/test.ics',
        typeId: '11111111-1111-4111-8111-111111111111',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Sesja wygasła');
      }
    });

    it('returns badRequest when input validation fails', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ id: 'user-1' });
      mockSupabaseClient = {} as unknown as SupabaseClient<Database>;

      const result = await addSubscription({
        name: '',
        url: 'https://example.com/test.ics',
        typeId: '11111111-1111-4111-8111-111111111111',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Nazwa jest wymagana');
      }
    });

    it('inserts subscription and runs sync on valid input', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ id: 'user-1' });
      mockSyncSubscription.mockResolvedValueOnce({ ok: true, count: 5 });

      mockSupabaseClient = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'new-sub-id' }, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await addSubscription({
        name: 'Mój kalendarz',
        url: 'https://example.com/cal.ics',
        typeId: '11111111-1111-4111-8111-111111111111',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe('new-sub-id');
      }
      expect(mockSyncSubscription).toHaveBeenCalledWith(mockSupabaseClient, 'new-sub-id', expect.any(Date));
      expect(mockReplanForUser).toHaveBeenCalledWith(mockSupabaseClient, 'user-1', expect.any(Date));
    });

    it('does not call replanForUser when initial sync fails in addSubscription (H-4)', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ id: 'user-1' });
      mockSyncSubscription.mockResolvedValueOnce({ ok: false, error: 'SSRF blocked' });

      mockSupabaseClient = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'new-sub-id' }, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await addSubscription({
        name: 'Mój kalendarz',
        url: 'https://example.com/cal.ics',
        typeId: '11111111-1111-4111-8111-111111111111',
      });

      expect(result.ok).toBe(true);
      expect(mockReplanForUser).not.toHaveBeenCalled();
    });

    it('succeeds even if replanForUser throws an error (H-4 resilience)', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ id: 'user-1' });
      mockSyncSubscription.mockResolvedValueOnce({ ok: true, count: 5 });
      mockReplanForUser.mockRejectedValueOnce(new Error('Scheduler crashed'));

      mockSupabaseClient = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'new-sub-id' }, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await addSubscription({
        name: 'Mój kalendarz',
        url: 'https://example.com/cal.ics',
        typeId: '11111111-1111-4111-8111-111111111111',
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('removeSubscription action', () => {
    it('returns unauthorized when user is not signed in', async () => {
      mockGetCurrentUser.mockResolvedValueOnce(null);
      mockSupabaseClient = {} as unknown as SupabaseClient<Database>;

      const result = await removeSubscription({
        subscriptionId: '11111111-1111-4111-8111-111111111111',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Sesja wygasła');
      }
    });

    it('deletes subscription and returns ok', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ id: 'user-1' });
      mockSupabaseClient = {
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await removeSubscription({
        subscriptionId: '11111111-1111-4111-8111-111111111111',
      });

      expect(result.ok).toBe(true);
      expect(mockReplanForUser).toHaveBeenCalledWith(mockSupabaseClient, 'user-1', expect.any(Date));
    });
  });

  describe('syncSubscriptionAction', () => {
    it('syncs subscription and returns count on success', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ id: 'user-1' });
      mockSyncSubscription.mockResolvedValueOnce({ ok: true, count: 12 });
      mockSupabaseClient = {} as unknown as SupabaseClient<Database>;

      const result = await syncSubscriptionAction({
        subscriptionId: '11111111-1111-4111-8111-111111111111',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(12);
      }
      expect(mockReplanForUser).toHaveBeenCalledWith(mockSupabaseClient, 'user-1', expect.any(Date));
    });

    it('returns badRequest when sync fails', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ id: 'user-1' });
      mockSyncSubscription.mockResolvedValueOnce({
        ok: false,
        error: 'Przekroczono limit czasu połączenia (10 s)',
      });
      mockSupabaseClient = {} as unknown as SupabaseClient<Database>;

      const result = await syncSubscriptionAction({
        subscriptionId: '11111111-1111-4111-8111-111111111111',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Przekroczono limit czasu połączenia (10 s)');
      }
      expect(mockReplanForUser).not.toHaveBeenCalled();
    });
  });
});
