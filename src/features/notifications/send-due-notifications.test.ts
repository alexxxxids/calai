import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('web-push', () => {
  class MockWebPushError extends Error {
    statusCode = 0;
    headers: Record<string, string> = {};
    body = '';
    endpoint = '';
  }

  return {
    default: {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn(),
    },
    WebPushError: MockWebPushError,
  };
});

vi.mock('@/lib/env', () => ({
  serverEnv: vi.fn(() => ({
    SUPABASE_SECRET_KEY: 'sb_secret_dummy',
    GEMINI_API_KEY: 'dummy',
    GEMINI_MODEL: 'dummy',
    CRON_SECRET: 'dummy-cron-secret-12345678',
    APP_URL: 'http://localhost:3000',
    VAPID_PRIVATE_KEY: 'dummy-private-key',
    VAPID_SUBJECT: 'mailto:admin@calai.test',
  })),
}));

import webpush, { WebPushError } from 'web-push';
import { sendDueNotifications } from './send-due-notifications';
import { sendPushToSubscription } from './push-sender';
import type { NotificationAdmin } from './types';

function createMockWebPushError(statusCode: number, endpoint: string): WebPushError {
  const err = Object.create(WebPushError.prototype) as WebPushError;
  Object.assign(err, {
    message: `WebPush error ${statusCode}`,
    statusCode,
    headers: {},
    body: '',
    endpoint,
  });
  return err;
}

describe('sendDueNotifications and push delivery engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'dummy-public-key';
  });

  describe('push-sender error handling (H-6)', () => {
    const mockSub = {
      id: 'sub-1',
      user_id: 'user-1',
      endpoint: 'https://push.example.com/sub-1',
      p256dh: 'dummy-p256',
      auth_secret: 'dummy-auth',
    };

    it('prunes subscription on 410 Gone error', async () => {
      const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqMock });
      const adminMock = {
        from: vi.fn().mockReturnValue({ delete: deleteMock }),
      } as unknown as NotificationAdmin;

      vi.mocked(webpush.sendNotification).mockRejectedValueOnce(
        createMockWebPushError(410, mockSub.endpoint),
      );

      const result = await sendPushToSubscription(adminMock, mockSub, {
        title: 'Test',
        body: 'Body',
      });

      expect(result.success).toBe(false);
      expect(result.pruned).toBe(true);
      expect(deleteEqMock).toHaveBeenCalledWith('endpoint', mockSub.endpoint);
    });

    it('prunes subscription on 404 Not Found error', async () => {
      const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqMock });
      const adminMock = {
        from: vi.fn().mockReturnValue({ delete: deleteMock }),
      } as unknown as NotificationAdmin;

      vi.mocked(webpush.sendNotification).mockRejectedValueOnce(
        createMockWebPushError(404, mockSub.endpoint),
      );

      const result = await sendPushToSubscription(adminMock, mockSub, {
        title: 'Test',
        body: 'Body',
      });

      expect(result.success).toBe(false);
      expect(result.pruned).toBe(true);
      expect(deleteEqMock).toHaveBeenCalledWith('endpoint', mockSub.endpoint);
    });

    it('does not prune subscription on 500 server error', async () => {
      const adminMock = {
        from: vi.fn(),
      } as unknown as NotificationAdmin;

      vi.mocked(webpush.sendNotification).mockRejectedValueOnce(
        createMockWebPushError(500, mockSub.endpoint),
      );

      const result = await sendPushToSubscription(adminMock, mockSub, {
        title: 'Test',
        body: 'Body',
      });

      expect(result.success).toBe(false);
      expect(result.pruned).toBe(false);
      expect(adminMock.from).not.toHaveBeenCalled();
    });
  });

  describe('upcoming blocks notifications (H-1)', () => {
    it('marks processed blocks with notified_at even if user has 0 subscriptions', async () => {
      const now = new Date('2026-10-12T10:00:00.000Z');
      const startsAt = new Date('2026-10-12T10:10:00.000Z').toISOString();

      const blocksMock = [
        {
          id: 'block-1',
          user_id: 'user-without-subs',
          starts_at: startsAt,
          tasks: { id: 'task-1', task_types: { name: 'Fizyka' } },
        },
      ];

      const updateInMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ in: updateInMock });

      const adminMock = {
        from: vi.fn((table: string) => {
          if (table === 'blocks') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    gte: vi.fn().mockReturnValue({
                      lt: vi.fn().mockResolvedValue({ data: blocksMock, error: null }),
                    }),
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ id: 'user-without-subs', timezone: 'Europe/Warsaw' }],
                  error: null,
                }),
              }),
            };
          }
          if (table === 'push_subscriptions') {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }
          return {};
        }),
      } as unknown as NotificationAdmin;

      const result = await sendDueNotifications(adminMock, now);
      expect(result.upcomingSent).toBe(0);
      expect(updateMock).toHaveBeenCalledWith({ notified_at: now.toISOString() });
      expect(updateInMock).toHaveBeenCalledWith('id', ['block-1']);
    });

    it('does not mark blocks as notified if fetching subscriptions fails with DB error (H-3)', async () => {
      const now = new Date('2026-10-12T10:00:00.000Z');
      const startsAt = new Date('2026-10-12T10:10:00.000Z').toISOString();

      const blocksMock = [
        {
          id: 'block-1',
          user_id: 'user-1',
          starts_at: startsAt,
          tasks: { id: 'task-1', task_types: { name: 'Fizyka' } },
        },
      ];

      const updateMock = vi.fn();

      const adminMock = {
        from: vi.fn((table: string) => {
          if (table === 'blocks') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    gte: vi.fn().mockReturnValue({
                      lt: vi.fn().mockResolvedValue({ data: blocksMock, error: null }),
                    }),
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ id: 'user-1', timezone: 'Europe/Warsaw' }],
                  error: null,
                }),
              }),
            };
          }
          if (table === 'push_subscriptions') {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB connection failure' } }),
              }),
            };
          }
          return {};
        }),
      } as unknown as NotificationAdmin;

      const result = await sendDueNotifications(adminMock, now);
      expect(result.upcomingSent).toBe(0);
      expect(updateMock).not.toHaveBeenCalled();
    });
  });
});
