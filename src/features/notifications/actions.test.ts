import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isCurrentDeviceSubscribed, subscribePush, unsubscribePush } from './actions';

describe('notifications actions', () => {
  const mockUser = { id: 'user-uuid-1', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(),
      rpc: vi.fn(),
    } as never);
  });

  describe('subscribePush', () => {
    it('returns invalidInput when payload is not conforming to schema', async () => {
      const result = await subscribePush({ endpoint: 'invalid-url' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Popraw zaznaczone pola.');
      }
    });

    it('returns unauthorized when no user is signed in', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await subscribePush({
        endpoint: 'https://push.example.com/sub/123',
        p256dh: 'dummy-p256dh',
        authSecret: 'dummy-auth',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Sesja wygasła. Zaloguj się ponownie.');
      }
    });

    it('calls claim_push_subscription and returns id on success', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as never);
      const mockRpc = vi.fn().mockResolvedValue({
        data: 'new-sub-id-123',
        error: null,
      });

      vi.mocked(createClient).mockResolvedValue({
        rpc: mockRpc,
      } as never);

      const result = await subscribePush({
        endpoint: 'https://push.example.com/sub/123',
        p256dh: 'dummy-p256dh',
        authSecret: 'dummy-auth',
        userAgent: 'test-agent',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe('new-sub-id-123');
      }
      expect(mockRpc).toHaveBeenCalledWith('claim_push_subscription', {
        p_endpoint: 'https://push.example.com/sub/123',
        p_p256dh: 'dummy-p256dh',
        p_auth_secret: 'dummy-auth',
        p_user_agent: 'test-agent',
      });
    });

    it('returns fail when rpc returns error', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as never);
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      vi.mocked(createClient).mockResolvedValue({
        rpc: mockRpc,
      } as never);

      const result = await subscribePush({
        endpoint: 'https://push.example.com/sub/123',
        p256dh: 'dummy-p256dh',
        authSecret: 'dummy-auth',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Nie udało się zapisać subskrypcji');
      }
    });
  });

  describe('unsubscribePush', () => {
    it('returns unauthorized when no user is signed in', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await unsubscribePush({
        endpoint: 'https://push.example.com/sub/123',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Sesja wygasła. Zaloguj się ponownie.');
      }
    });

    it('deletes subscription by endpoint successfully', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as never);

      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ delete: deleteMock });

      vi.mocked(createClient).mockResolvedValue({
        from: fromMock,
      } as never);

      const result = await unsubscribePush({
        endpoint: 'https://push.example.com/sub/123',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(true);
      }
      expect(fromMock).toHaveBeenCalledWith('push_subscriptions');
      expect(eqMock).toHaveBeenCalledWith('endpoint', 'https://push.example.com/sub/123');
    });

    it('returns unexpected when deletion fails', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as never);

      const eqMock = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ delete: deleteMock });

      vi.mocked(createClient).mockResolvedValue({
        from: fromMock,
      } as never);

      const result = await unsubscribePush({
        endpoint: 'https://push.example.com/sub/123',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
      }
    });
  });

  describe('isCurrentDeviceSubscribed', () => {
    it('returns false when endpoint schema is invalid', async () => {
      const result = await isCurrentDeviceSubscribed({ endpoint: 'invalid-url' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.subscribed).toBe(false);
      }
    });

    it('returns unauthorized when no user is signed in', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await isCurrentDeviceSubscribed({
        endpoint: 'https://push.example.com/sub/123',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Sesja wygasła. Zaloguj się ponownie.');
      }
    });

    it('returns subscribed: true when endpoint is owned by user', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as never);

      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: { id: 'sub-1' },
        error: null,
      });
      const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      vi.mocked(createClient).mockResolvedValue({
        from: fromMock,
      } as never);

      const result = await isCurrentDeviceSubscribed({
        endpoint: 'https://push.example.com/sub/123',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.subscribed).toBe(true);
      }
      expect(eqMock).toHaveBeenCalledWith('endpoint', 'https://push.example.com/sub/123');
    });

    it('returns subscribed: false when endpoint is not in database', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as never);

      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      vi.mocked(createClient).mockResolvedValue({
        from: fromMock,
      } as never);

      const result = await isCurrentDeviceSubscribed({
        endpoint: 'https://push.example.com/sub/123',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.subscribed).toBe(false);
      }
    });
  });
});
