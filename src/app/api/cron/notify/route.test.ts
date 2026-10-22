import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}));
vi.mock('@/lib/env', () => ({
  serverEnv: vi.fn(() => ({
    CRON_SECRET: 'test-secret-value-1234567890',
  })),
}));
vi.mock('@/features/notifications/send-due-notifications', () => ({
  sendDueNotifications: vi.fn().mockResolvedValue({
    upcomingSent: 2,
    eveningSent: 1,
    sundaySent: 0,
  }),
}));

import { sendDueNotifications } from '@/features/notifications/send-due-notifications';
import { POST } from './route';

describe('POST /api/cron/notify route handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const request = new Request('http://localhost:3000/api/cron/notify', {
      method: 'POST',
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const request = new Request('http://localhost:3000/api/cron/notify', {
      method: 'POST',
      headers: {
        Authorization: 'Basic dXNlcjpwYXNz',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 401 when Bearer token is incorrect', async () => {
    const request = new Request('http://localhost:3000/api/cron/notify', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer wrong-secret-token',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 401 when token length differs significantly without throwing', async () => {
    const request = new Request('http://localhost:3000/api/cron/notify', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer a',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 200 and calls sendDueNotifications when secret is valid', async () => {
    const request = new Request('http://localhost:3000/api/cron/notify', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-secret-value-1234567890',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = (await response.json()) as {
      ok: boolean;
      result: { upcomingSent: number; eveningSent: number; sundaySent: number };
    };

    expect(json.ok).toBe(true);
    expect(json.result.upcomingSent).toBe(2);
    expect(sendDueNotifications).toHaveBeenCalled();
  });
});
