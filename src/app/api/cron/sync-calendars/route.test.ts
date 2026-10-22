import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}));
vi.mock('@/lib/env', () => ({
  serverEnv: vi.fn(() => ({
    CRON_SECRET: 'test-cron-secret-1234567890',
  })),
}));
vi.mock('@/features/calendar-sync/sync-subscription', () => ({
  syncAllSubscriptions: vi.fn().mockResolvedValue({
    total: 2,
    succeeded: 2,
    failed: 0,
    results: [
      { id: 'sub-1', ok: true, count: 5 },
      { id: 'sub-2', ok: true, count: 3 },
    ],
  }),
}));

import { syncAllSubscriptions } from '@/features/calendar-sync/sync-subscription';
import { GET, POST, maxDuration } from './route';

describe('/api/cron/sync-calendars route handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports maxDuration = 60 for Vercel serverless execution (H-2)', () => {
    expect(maxDuration).toBe(60);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const request = new Request('http://localhost:3000/api/cron/sync-calendars', {
      method: 'POST',
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const request = new Request('http://localhost:3000/api/cron/sync-calendars', {
      method: 'POST',
      headers: {
        Authorization: 'Basic dXNlcjpwYXNz',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 401 when Bearer token is incorrect', async () => {
    const request = new Request('http://localhost:3000/api/cron/sync-calendars', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer wrong-secret-token',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 401 when token length differs significantly without throwing', async () => {
    const request = new Request('http://localhost:3000/api/cron/sync-calendars', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer a',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 200 and calls syncAllSubscriptions for POST when secret is valid', async () => {
    const request = new Request('http://localhost:3000/api/cron/sync-calendars', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-cron-secret-1234567890',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = (await response.json()) as {
      ok: boolean;
      result: { total: number; succeeded: number; failed: number };
    };

    expect(json.ok).toBe(true);
    expect(json.result.total).toBe(2);
    expect(json.result.succeeded).toBe(2);
    expect(syncAllSubscriptions).toHaveBeenCalledTimes(1);
  });

  it('returns 200 and calls syncAllSubscriptions for GET when secret is valid', async () => {
    const request = new Request('http://localhost:3000/api/cron/sync-calendars', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-cron-secret-1234567890',
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const json = (await response.json()) as {
      ok: boolean;
      result: { total: number; succeeded: number; failed: number };
    };

    expect(json.ok).toBe(true);
    expect(json.result.total).toBe(2);
    expect(syncAllSubscriptions).toHaveBeenCalledTimes(1);
  });
});
