import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/features/calendar-sync/build-feed', () => ({
  buildFeed: vi.fn(),
}));

import { createAdminClient } from '@/lib/supabase/admin';
import { buildFeed } from '@/features/calendar-sync/build-feed';
import { GET } from './route';

describe('GET /api/ics/[token]', () => {
  const validToken = 'e7f6d5c4b3a29180f1e2d3c4b5a69788e7f6d5c4b3a29180f1e2d3c4b5a69788';
  const sampleUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 immediately for invalid token format without calling createAdminClient', async () => {
    const invalidTokens = ['not-a-token', 'a'.repeat(63), 'A'.repeat(64), 'xyz'];

    for (const token of invalidTokens) {
      const response = await GET(new Request('http://localhost:3000/api/ics/' + token), {
        params: Promise.resolve({ token }),
      });

      expect(response.status).toBe(404);
      const text = await response.text();
      expect(text).toBe('Not Found');
    }

    expect(createAdminClient).not.toHaveBeenCalled();
    expect(buildFeed).not.toHaveBeenCalled();
  });

  it('returns 404 when a valid 64-hex token is not found in database', async () => {
    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as unknown as ReturnType<typeof createAdminClient>);

    const response = await GET(new Request('http://localhost:3000/api/ics/' + validToken), {
      params: Promise.resolve({ token: validToken }),
    });

    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).toBe('Not Found');
    expect(createAdminClient).toHaveBeenCalled();
    expect(buildFeed).not.toHaveBeenCalled();
  });

  it('returns 500 when database error occurs during feed lookup', async () => {
    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as unknown as ReturnType<typeof createAdminClient>);

    const response = await GET(new Request('http://localhost:3000/api/ics/' + validToken), {
      params: Promise.resolve({ token: validToken }),
    });

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toBe('Internal Server Error');
    expect(buildFeed).not.toHaveBeenCalled();
  });

  it('returns 500 when buildFeed throws an error', async () => {
    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { user_id: sampleUserId },
          error: null,
        }),
      }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(buildFeed).mockRejectedValue(new Error('Feed serialization failed'));

    const response = await GET(new Request('http://localhost:3000/api/ics/' + validToken), {
      params: Promise.resolve({ token: validToken }),
    });

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toBe('Internal Server Error');
  });

  it('returns 200 with text/calendar headers and content on success', async () => {
    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { user_id: sampleUserId },
          error: null,
        }),
      }),
    };
    const sampleIcsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR';

    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(buildFeed).mockResolvedValue(sampleIcsContent);

    const response = await GET(new Request('http://localhost:3000/api/ics/' + validToken), {
      params: Promise.resolve({ token: validToken }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toContain('no-cache');
    expect(response.headers.get('Content-Disposition')).toContain('inline; filename="calendar.ics"');

    const body = await response.text();
    expect(body).toBe(sampleIcsContent);
    expect(buildFeed).toHaveBeenCalledWith(mockAdmin, sampleUserId);
  });
});
