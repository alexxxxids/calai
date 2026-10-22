import { instantToLocalTime } from '@/domain/time';
import type { Instant } from '@/domain/types';
import type { NotificationPayload } from './schemas';

export const DEFAULT_NOTIFICATION_ICON = '/icon-192.png';
export const CALENDAR_ROUTE = '/calendar';
export const REFLECTION_ROUTE = '/reflection';

interface UpcomingBlockParams {
  readonly blockId: string;
  readonly typeName: string | null;
  readonly startsAt: string;
  readonly timezone: string;
}

/**
 * Creates notification payload for an upcoming planned block.
 */
export function createUpcomingBlockPayload(params: UpcomingBlockParams): NotificationPayload {
  const startsAtMs: Instant = new Date(params.startsAt).getTime();
  const timeStr = instantToLocalTime(startsAtMs, params.timezone);
  const title = params.typeName ? `Nadchodzące: ${params.typeName}` : 'Nadchodzące zadanie';
  const body = `Rozpoczyna się o ${timeStr}.`;

  return {
    title,
    body,
    icon: DEFAULT_NOTIFICATION_ICON,
    tag: `block-${params.blockId}`,
    data: { url: CALENDAR_ROUTE },
  };
}

/**
 * Creates notification payload for the evening "Zamknij dzień" reminder.
 */
export function createCloseDayPayload(
  unclosedCount: number,
  localDate: string,
): NotificationPayload {
  const title = 'Zamknij dzień';
  const body = `Masz niezamknięte bloki (${unclosedCount}). Podsumuj swój dzień w CalAI.`;

  return {
    title,
    body,
    icon: DEFAULT_NOTIFICATION_ICON,
    tag: `close-day-${localDate}`,
    data: { url: CALENDAR_ROUTE },
  };
}

/**
 * Creates notification payload for the Sunday 19:00 reflection reminder.
 */
export function createWeeklyReflectionPayload(weekMonday: string): NotificationPayload {
  const title = 'Cotygodniowa refleksja';
  const body = 'Niedziela 19:00 — czas na podsumowanie tygodnia w CalAI.';

  return {
    title,
    body,
    icon: DEFAULT_NOTIFICATION_ICON,
    tag: `weekly-reflection-${weekMonday}`,
    data: { url: REFLECTION_ROUTE },
  };
}
