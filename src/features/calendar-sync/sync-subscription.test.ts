import dns from 'node:dns';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('node:dns', () => {
  const lookupMock = vi.fn();
  return {
    default: {
      promises: {
        lookup: lookupMock,
      },
    },
    promises: {
      lookup: lookupMock,
    },
  };
});

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  fetchIcalFeed,
  formatSyncError,
  syncAllSubscriptions,
  syncSubscription,
  validateHostNotPrivate,
  MAX_FEED_SIZE_BYTES,
} from './sync-subscription';

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:event-123
DTSTART:20261025T100000Z
DTEND:20261025T110000Z
SUMMARY:Spotkanie projektowe
END:VEVENT
END:VCALENDAR`;

function createStreamResponse(chunks: Uint8Array[], headers?: Record<string, string>): Response {
  let isCancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        if (isCancelled) {
          break;
        }
        controller.enqueue(chunk);
      }
      controller.close();
    },
    cancel() {
      isCancelled = true;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      ...headers,
    },
  });
}

const mockLookup = dns.promises.lookup as unknown as {
  mockResolvedValue: (records: Array<{ address: string; family: number }>) => void;
  mockResolvedValueOnce: (records: Array<{ address: string; family: number }>) => void;
};

describe('sync-subscription', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
    ]);
  });

  describe('validateHostNotPrivate', () => {
    it('blocks localhost directly without DNS lookup', async () => {
      await expect(validateHostNotPrivate('localhost')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
      expect(dns.promises.lookup).not.toHaveBeenCalled();
    });

    it('blocks subdomains of localhost and internal names', async () => {
      await expect(validateHostNotPrivate('app.localhost')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
      await expect(validateHostNotPrivate('service.local')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
      await expect(validateHostNotPrivate('cluster.internal')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
    });

    it('blocks direct private IPv4 addresses without DNS lookup', async () => {
      await expect(validateHostNotPrivate('127.0.0.1')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
      await expect(validateHostNotPrivate('10.0.0.1')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
      await expect(validateHostNotPrivate('192.168.1.1')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
      await expect(validateHostNotPrivate('169.254.169.254')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
      expect(dns.promises.lookup).not.toHaveBeenCalled();
    });

    it('blocks direct IPv6 loopback and private addresses', async () => {
      await expect(validateHostNotPrivate('::1')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
      await expect(validateHostNotPrivate('[::1]')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
      await expect(validateHostNotPrivate('fe80::1')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
      expect(dns.promises.lookup).not.toHaveBeenCalled();
    });

    it('resolves public domain and succeeds when IP is public', async () => {
      mockLookup.mockResolvedValueOnce([
        { address: '93.184.216.34', family: 4 },
      ]);
      await expect(validateHostNotPrivate('example.com')).resolves.toBeUndefined();
      expect(dns.promises.lookup).toHaveBeenCalledWith('example.com', { all: true });
    });

    it('detects DNS rebinding attack (H-3): domain resolves to 127.0.0.1', async () => {
      mockLookup.mockResolvedValueOnce([
        { address: '127.0.0.1', family: 4 },
      ]);
      await expect(validateHostNotPrivate('rebind.attacker.com')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
    });

    it('detects DNS rebinding attack (H-3): domain resolves to private IPv6', async () => {
      mockLookup.mockResolvedValueOnce([
        { address: '::1', family: 6 },
      ]);
      await expect(validateHostNotPrivate('rebind6.attacker.com')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
    });

    it('blocks if any of multiple returned IP records is private', async () => {
      mockLookup.mockResolvedValueOnce([
        { address: '93.184.216.34', family: 4 },
        { address: '10.200.0.1', family: 4 },
      ]);
      await expect(validateHostNotPrivate('multi-ip.attacker.com')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
    });
  });

  describe('fetchIcalFeed', () => {
    it('downloads feed successfully over HTTPS', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(SAMPLE_ICS, {
          status: 200,
          headers: { 'Content-Type': 'text/calendar' },
        })
      );

      const result = await fetchIcalFeed('https://example.com/calendar.ics');
      expect(result).toBe(SAMPLE_ICS);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/calendar.ics',
        expect.objectContaining({
          redirect: 'manual',
          headers: { Accept: 'text/calendar, text/plain, */*' },
        })
      );
    });

    it('rejects initial non-HTTPS URLs', async () => {
      await expect(fetchIcalFeed('http://example.com/calendar.ics')).rejects.toThrow(
        'Wymagany protokół HTTPS'
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('follows HTTPS redirect (301/302) safely (H-2)', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            headers: { Location: 'https://cdn.example.com/actual-feed.ics' },
          })
        )
        .mockResolvedValueOnce(
          new Response(SAMPLE_ICS, {
            status: 200,
            headers: { 'Content-Type': 'text/calendar' },
          })
        );

      const result = await fetchIcalFeed('https://example.com/initial.ics');
      expect(result).toBe(SAMPLE_ICS);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://cdn.example.com/actual-feed.ics',
        expect.anything()
      );
    });

    it('follows relative redirect safely', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(null, {
            status: 301,
            headers: { Location: '/redirected.ics' },
          })
        )
        .mockResolvedValueOnce(
          new Response(SAMPLE_ICS, {
            status: 200,
          })
        );

      const result = await fetchIcalFeed('https://example.com/path/feed.ics');
      expect(result).toBe(SAMPLE_ICS);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://example.com/redirected.ics',
        expect.anything()
      );
    });

    it('blocks redirect to HTTP (H-2)', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: 'http://example.com/unencrypted.ics' },
        })
      );

      await expect(fetchIcalFeed('https://example.com/feed.ics')).rejects.toThrow(
        'Wymagany protokół HTTPS'
      );
    });

    it('blocks redirect to private IP address (H-2)', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: 'https://192.168.1.1/router.ics' },
        })
      );

      await expect(fetchIcalFeed('https://example.com/feed.ics')).rejects.toThrow(
        'Zablokowano adres sieci prywatnej (SSRF)'
      );
    });

    it('throws error when redirects exceed MAX_REDIRECTS (3)', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(null, { status: 302, headers: { Location: 'https://example.com/r1' } })
        )
        .mockResolvedValueOnce(
          new Response(null, { status: 302, headers: { Location: 'https://example.com/r2' } })
        )
        .mockResolvedValueOnce(
          new Response(null, { status: 302, headers: { Location: 'https://example.com/r3' } })
        )
        .mockResolvedValueOnce(
          new Response(null, { status: 302, headers: { Location: 'https://example.com/r4' } })
        );

      await expect(fetchIcalFeed('https://example.com/initial')).rejects.toThrow(
        'Zbyt wiele przekierowań'
      );
    });

    it('throws error on missing Location header in redirect', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 302,
        })
      );

      await expect(fetchIcalFeed('https://example.com/feed.ics')).rejects.toThrow(
        'Błąd pobierania kalendarza (HTTP 302)'
      );
    });

    it('throws error on HTTP 404 response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Not Found', {
          status: 404,
        })
      );

      await expect(fetchIcalFeed('https://example.com/feed.ics')).rejects.toThrow(
        'Błąd pobierania kalendarza (HTTP 404)'
      );
    });

    it('rejects feed when Content-Length header exceeds 2 MB (H-8)', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: {
            'content-length': String(MAX_FEED_SIZE_BYTES + 100),
          },
        })
      );

      await expect(fetchIcalFeed('https://example.com/huge.ics')).rejects.toThrow(
        'Rozmiar pliku kalendarza przekracza limit 2 MB'
      );
    });

    it('rejects feed when streaming chunked transfer exceeds 2 MB (H-8)', async () => {
      const oneMbChunk = new Uint8Array(1024 * 1024);
      const onePointTwoMbChunk = new Uint8Array(1.2 * 1024 * 1024);

      mockFetch.mockResolvedValueOnce(
        createStreamResponse([oneMbChunk, onePointTwoMbChunk])
      );

      await expect(fetchIcalFeed('https://example.com/stream-huge.ics')).rejects.toThrow(
        'Rozmiar pliku kalendarza przekracza limit 2 MB'
      );
    });

    it('handles empty response body gracefully', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
        })
      );

      const result = await fetchIcalFeed('https://example.com/empty.ics');
      expect(result).toBe('');
    });
  });

  describe('formatSyncError (H-11)', () => {
    it('formats timeout error', () => {
      const err = new DOMException('Request timeout', 'TimeoutError');
      expect(formatSyncError(err)).toBe('Przekroczono limit czasu połączenia (10 s)');
    });

    it('formats abort error', () => {
      const err = new DOMException('Operation aborted', 'AbortError');
      expect(formatSyncError(err)).toBe('Przekroczono limit czasu połączenia (10 s)');
    });

    it('formats message containing timeout string', () => {
      const err = new Error('fetch failed: connection timed out');
      expect(formatSyncError(err)).toBe('Przekroczono limit czasu połączenia (10 s)');
    });

    it('formats file size limit error', () => {
      const err = new Error('Rozmiar pliku kalendarza przekracza limit 2 MB');
      expect(formatSyncError(err)).toBe('Rozmiar pliku kalendarza przekracza limit 2 MB');
    });

    it('formats SSRF error', () => {
      const err = new Error('Zablokowano adres sieci prywatnej (SSRF)');
      expect(formatSyncError(err)).toBe('Zablokowano adres sieci prywatnej (SSRF)');
    });

    it('formats HTTP status error', () => {
      const err = new Error('Błąd pobierania kalendarza (HTTP 500)');
      expect(formatSyncError(err)).toBe('Błąd pobierania kalendarza (HTTP 500)');
    });

    it('truncates very long error message to 200 characters', () => {
      const longMessage = 'A'.repeat(300);
      const formatted = formatSyncError(new Error(longMessage));
      expect(formatted).toHaveLength(200);
      expect(formatted).toBe('A'.repeat(200));
    });

    it('handles string input and unknown error types', () => {
      expect(formatSyncError('Custom string error')).toBe('Custom string error');
      expect(formatSyncError(null)).toBe('Nieznany błąd synchronizacji');
      expect(formatSyncError({})).toBe('Nieznany błąd synchronizacji');
    });
  });

  describe('syncSubscription', () => {
    const fixedNow = new Date('2026-10-25T12:00:00Z');

    it('returns not found when subscription does not exist', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await syncSubscription(mockSupabase, 'sub-nonexistent', fixedNow);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Nie znaleziono subskrypcji');
    });

    it('successfully syncs subscription and calls replace_external_events', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(SAMPLE_ICS, {
          status: 200,
          headers: { 'Content-Type': 'text/calendar' },
        })
      );

      const mockRpc = vi.fn().mockResolvedValue({ data: 1, error: null });
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'sub-123',
                  user_id: 'user-456',
                  name: 'Mój plan',
                  url: 'https://example.com/calendar.ics',
                },
                error: null,
              }),
            }),
          }),
        }),
        rpc: mockRpc,
      } as unknown as SupabaseClient<Database>;

      const result = await syncSubscription(mockSupabase, 'sub-123', fixedNow);

      expect(result.ok).toBe(true);
      expect(result.count).toBe(1);
      expect(mockRpc).toHaveBeenCalledWith('replace_external_events', {
        p_subscription_id: 'sub-123',
        p_events: expect.arrayContaining([
          expect.objectContaining({
            uid: 'event-123',
            title: 'Spotkanie projektowe',
          }),
        ]),
      });
    });

    it('records last_error and last_synced_at in database when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Internal Server Error', {
          status: 500,
        })
      );

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'calendar_subscriptions') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'sub-err',
                      user_id: 'user-456',
                      name: 'Błędny kalendarz',
                      url: 'https://example.com/broken.ics',
                    },
                    error: null,
                  }),
                }),
              }),
              update: mockUpdate,
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await syncSubscription(mockSupabase, 'sub-err', fixedNow);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Błąd pobierania kalendarza (HTTP 500)');
      expect(mockUpdate).toHaveBeenCalledWith({
        last_error: 'Błąd pobierania kalendarza (HTTP 500)',
        last_synced_at: fixedNow.toISOString(),
      });
    });

    it('records last_error when database RPC replace_external_events fails', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(SAMPLE_ICS, {
          status: 200,
          headers: { 'Content-Type': 'text/calendar' },
        })
      );

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'sub-rpc-err',
                  user_id: 'user-456',
                  name: 'Test',
                  url: 'https://example.com/cal.ics',
                },
                error: null,
              }),
            }),
          }),
          update: mockUpdate,
        }),
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database transaction error' },
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await syncSubscription(mockSupabase, 'sub-rpc-err', fixedNow);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Database transaction error');
      expect(mockUpdate).toHaveBeenCalledWith({
        last_error: 'Database transaction error',
        last_synced_at: fixedNow.toISOString(),
      });
    });
  });

  describe('syncAllSubscriptions', () => {
    const fixedNow = new Date('2026-10-25T12:00:00Z');

    it('returns empty summary when no subscriptions exist', async () => {
      const mockAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      } as unknown as SupabaseClient<Database>;

      const summary = await syncAllSubscriptions(mockAdmin, fixedNow);
      expect(summary).toEqual({
        total: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      });
    });

    it('isolates failures: successful subscription succeeds even if another fails', async () => {
      // First fetch (sub-1) succeeds, second fetch (sub-2) fails with 404
      mockFetch
        .mockResolvedValueOnce(
          new Response(SAMPLE_ICS, {
            status: 200,
            headers: { 'Content-Type': 'text/calendar' },
          })
        )
        .mockResolvedValueOnce(
          new Response('Not Found', {
            status: 404,
          })
        );

      const mockAdmin = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'calendar_subscriptions') {
            return {
              select: vi.fn().mockImplementation((cols: string) => {
                if (cols === 'id') {
                  return Promise.resolve({
                    data: [{ id: 'sub-1' }, { id: 'sub-2' }],
                    error: null,
                  });
                }
                return {
                  eq: vi.fn().mockImplementation((_field: string, val: string) => {
                    if (val === 'sub-1') {
                      return {
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: {
                            id: 'sub-1',
                            user_id: 'user-1',
                            name: 'Działający',
                            url: 'https://example.com/ok.ics',
                          },
                          error: null,
                        }),
                      };
                    }
                    return {
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                          id: 'sub-2',
                          user_id: 'user-2',
                          name: 'Zepsuty',
                          url: 'https://example.com/fail.ics',
                        },
                        error: null,
                      }),
                    };
                  }),
                };
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            };
          }
          return {};
        }),
        rpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
      } as unknown as SupabaseClient<Database>;

      const summary = await syncAllSubscriptions(mockAdmin, fixedNow);

      expect(summary.total).toBe(2);
      expect(summary.succeeded).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.results).toEqual([
        { id: 'sub-1', ok: true, count: 1 },
        { id: 'sub-2', ok: false, error: 'Błąd pobierania kalendarza (HTTP 404)' },
      ]);
    });
  });
});
