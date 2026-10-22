import ical, { ICalEventStatus } from 'ical-generator';

export const FEED_PAST_DAYS = 14;
export const FEED_FUTURE_DAYS = 60;
export const MS_PER_DAY = 86_400_000;

export const REST_FALLBACK_TITLE = 'Odpoczynek';
export const TASK_FALLBACK_TITLE = 'Zadanie';
export const CALENDAR_NAME = 'CalAI';
export const CALENDAR_PRODID_COMPANY = 'CalAI';
export const CALENDAR_PRODID_PRODUCT = 'Calendar Feed';
export const CALENDAR_PRODID_LANG = 'PL';

export interface FeedDateRange {
  start: Date;
  end: Date;
}

export function getFeedDateRange(now: Date = new Date()): FeedDateRange {
  const start = new Date(now.getTime() - FEED_PAST_DAYS * MS_PER_DAY);
  const end = new Date(now.getTime() + FEED_FUTURE_DAYS * MS_PER_DAY);
  return { start, end };
}

export interface FeedBlockItem {
  readonly id: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: 'planned' | 'done';
  readonly typeName: string;
  readonly notes?: string | null;
}

export function generateIcsFeed(blocks: readonly FeedBlockItem[]): string {
  const calendar = ical({
    name: CALENDAR_NAME,
    prodId: {
      company: CALENDAR_PRODID_COMPANY,
      product: CALENDAR_PRODID_PRODUCT,
      language: CALENDAR_PRODID_LANG,
    },
  });

  for (const block of blocks) {
    calendar.createEvent({
      id: `${block.id}@calai`,
      start: new Date(block.startsAt),
      end: new Date(block.endsAt),
      summary: block.typeName,
      description: block.notes?.trim() ? block.notes.trim() : undefined,
      status: ICalEventStatus.CONFIRMED,
    });
  }

  return calendar.toString();
}
