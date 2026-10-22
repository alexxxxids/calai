import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  FEED_FUTURE_DAYS,
  FEED_PAST_DAYS,
  generateIcsFeed,
  getFeedDateRange,
  REST_FALLBACK_TITLE,
  TASK_FALLBACK_TITLE,
  type FeedBlockItem,
} from './feed-generator';
import {
  FEED_TOKEN_LENGTH,
  feedTokenSchema,
  isValidFeedToken,
} from './schemas';
import { buildFeed } from './build-feed';
import { getCalendarFeedToken } from './queries';
import type { Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('isValidFeedToken & feedTokenSchema', () => {
  const validToken = 'a'.repeat(FEED_TOKEN_LENGTH);
  const sampleToken = 'e7f6d5c4b3a29180f1e2d3c4b5a69788e7f6d5c4b3a29180f1e2d3c4b5a69788';

  it('accepts valid 64-character lowercase hex tokens', () => {
    expect(isValidFeedToken(validToken)).toBe(true);
    expect(isValidFeedToken(sampleToken)).toBe(true);
    expect(feedTokenSchema.safeParse(validToken).success).toBe(true);
    expect(feedTokenSchema.safeParse(sampleToken).success).toBe(true);
  });

  it('rejects tokens with invalid length', () => {
    const tooShort = 'a'.repeat(63);
    const tooLong = 'a'.repeat(65);
    expect(isValidFeedToken(tooShort)).toBe(false);
    expect(isValidFeedToken(tooLong)).toBe(false);
    expect(feedTokenSchema.safeParse(tooShort).success).toBe(false);
    expect(feedTokenSchema.safeParse(tooLong).success).toBe(false);
  });

  it('rejects tokens containing uppercase characters or non-hex symbols', () => {
    const upperCaseToken = 'A'.repeat(FEED_TOKEN_LENGTH);
    const nonHexToken = 'g'.repeat(FEED_TOKEN_LENGTH);
    const withHyphens = 'e7f6d5c4-b3a2-9180-f1e2-d3c4b5a69788e7f6d5c4-b3a2-9180-f1e2-d3c4b5a69788';

    expect(isValidFeedToken(upperCaseToken)).toBe(false);
    expect(isValidFeedToken(nonHexToken)).toBe(false);
    expect(isValidFeedToken(withHyphens)).toBe(false);
    expect(isValidFeedToken('')).toBe(false);
    expect(isValidFeedToken('   ')).toBe(false);
  });

  it('rejects non-string values safely as a type guard', () => {
    expect(isValidFeedToken(null)).toBe(false);
    expect(isValidFeedToken(undefined)).toBe(false);
    expect(isValidFeedToken(12345)).toBe(false);
    expect(isValidFeedToken({})).toBe(false);
  });
});

describe('getFeedDateRange', () => {
  it('computes exactly 14 days in the past and 60 days in the future', () => {
    const anchor = new Date('2026-10-22T12:00:00.000Z');
    const range = getFeedDateRange(anchor);

    const expectedStart = new Date('2026-10-08T12:00:00.000Z');
    const expectedEnd = new Date('2026-12-21T12:00:00.000Z');

    expect(range.start.toISOString()).toBe(expectedStart.toISOString());
    expect(range.end.toISOString()).toBe(expectedEnd.toISOString());

    const diffPastDays = (anchor.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000);
    const diffFutureDays = (range.end.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000);

    expect(diffPastDays).toBe(FEED_PAST_DAYS);
    expect(diffFutureDays).toBe(FEED_FUTURE_DAYS);
  });
});

describe('generateIcsFeed', () => {
  it('generates a valid empty VCALENDAR when no blocks are provided', () => {
    const ics = generateIcsFeed([]);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//CalAI//Calendar Feed//PL');
    expect(ics).toContain('X-WR-CALNAME:CalAI');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('generates VEVENT items with stable UIDs, UTC dates, and correct summaries', () => {
    const blocks: FeedBlockItem[] = [
      {
        id: 'block-uuid-1',
        startsAt: '2026-10-22T10:00:00.000Z',
        endsAt: '2026-10-22T11:30:00.000Z',
        status: 'planned',
        typeName: 'Programowanie',
        notes: 'Implementacja iCal feed',
      },
      {
        id: 'block-uuid-2',
        startsAt: '2026-10-22T14:00:00.000Z',
        endsAt: '2026-10-22T15:00:00.000Z',
        status: 'done',
        typeName: 'Odpoczynek',
        notes: null,
      },
    ];

    const ics = generateIcsFeed(blocks);

    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:block-uuid-1@calai');
    expect(ics).toContain('DTSTART:20261022T100000Z');
    expect(ics).toContain('DTEND:20261022T113000Z');
    expect(ics).toContain('SUMMARY:Programowanie');
    expect(ics).toContain('DESCRIPTION:Implementacja iCal feed');
    expect(ics).toContain('STATUS:CONFIRMED');

    expect(ics).toContain('UID:block-uuid-2@calai');
    expect(ics).toContain('DTSTART:20261022T140000Z');
    expect(ics).toContain('DTEND:20261022T150000Z');
    expect(ics).toContain('SUMMARY:Odpoczynek');
    expect(ics).not.toContain('DESCRIPTION:null');
  });

  it('omits DESCRIPTION when notes is empty or whitespace only', () => {
    const block: FeedBlockItem = {
      id: 'block-3',
      startsAt: '2026-10-23T08:00:00.000Z',
      endsAt: '2026-10-23T09:00:00.000Z',
      status: 'planned',
      typeName: 'Nauka',
      notes: '   ',
    };

    const ics = generateIcsFeed([block]);
    expect(ics).toContain('UID:block-3@calai');
    expect(ics).toContain('SUMMARY:Nauka');
    expect(ics).not.toContain('DESCRIPTION:');
  });
});

describe('buildFeed', () => {
  it('queries blocks with task_id and source and builds correct feed items', async () => {
    const mockRows = [
      {
        id: 'b-task',
        task_id: 'task-1',
        source: 'planner',
        starts_at: '2026-10-22T08:00:00.000Z',
        ends_at: '2026-10-22T09:30:00.000Z',
        status: 'planned',
        tasks: {
          notes: 'Test note',
          task_types: { name: 'Matematyka' },
        },
      },
      {
        id: 'b-rest',
        task_id: null,
        source: 'rest',
        starts_at: '2026-10-22T09:30:00.000Z',
        ends_at: '2026-10-22T10:00:00.000Z',
        status: 'planned',
        tasks: null,
      },
      {
        id: 'b-fallback',
        task_id: 'task-no-type',
        source: 'manual',
        starts_at: '2026-10-22T11:00:00.000Z',
        ends_at: '2026-10-22T12:00:00.000Z',
        status: 'done',
        tasks: {
          notes: null,
          task_types: null,
        },
      },
    ];

    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
      }),
    } as unknown as SupabaseClient<Database>;

    const ics = await buildFeed(mockAdmin, 'user-123', new Date('2026-10-22T12:00:00.000Z'));

    expect(ics).toContain('SUMMARY:Matematyka');
    expect(ics).toContain(`SUMMARY:${REST_FALLBACK_TITLE}`);
    expect(ics).toContain(`SUMMARY:${TASK_FALLBACK_TITLE}`);
    expect(ics).toContain('UID:b-task@calai');
    expect(ics).toContain('UID:b-rest@calai');
    expect(ics).toContain('UID:b-fallback@calai');
  });

  it('throws an error when the database query fails', async () => {
    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database down' } }),
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(buildFeed(mockAdmin, 'user-123')).rejects.toThrow('Database down');
  });
});

describe('getCalendarFeedToken', () => {
  it('returns token when found in database', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { token: 'my-token' }, error: null }),
      }),
    } as unknown as Parameters<typeof getCalendarFeedToken>[0];

    const token = await getCalendarFeedToken(mockSupabase, 'user-1');
    expect(token).toBe('my-token');
  });

  it('returns null when not found in database', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as unknown as Parameters<typeof getCalendarFeedToken>[0];

    const token = await getCalendarFeedToken(mockSupabase, 'user-1');
    expect(token).toBeNull();
  });

  it('throws an error when database query fails (H-1)', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'Connection timeout' } }),
      }),
    } as unknown as Parameters<typeof getCalendarFeedToken>[0];

    await expect(getCalendarFeedToken(mockSupabase, 'user-1')).rejects.toThrow('Connection timeout');
  });
});
