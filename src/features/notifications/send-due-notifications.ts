import 'server-only';

import { sendEveningReminders } from './send-evening-reminders';
import { sendSundayReminders } from './send-sunday-reminders';
import { sendUpcomingBlocks } from './send-upcoming-blocks';
import type { NotificationAdmin } from './types';

export interface DueNotificationsResult {
  readonly upcomingSent: number;
  readonly eveningSent: number;
  readonly sundaySent: number;
}

/**
 * Coordinator for scheduled notifications (called every 5 minutes by Supabase Cron):
 * 1. Upcoming planned blocks in [now + 5m, now + 15m)
 * 2. Evening reminder "Zamknij dzień" at end of day window if unclosed blocks exist
 * 3. Sunday 19:00 reflection reminder for users with reflection level >= analytic
 */
export async function sendDueNotifications(
  admin: NotificationAdmin,
  now: Date,
): Promise<DueNotificationsResult> {
  const [upcomingSent, eveningSent, sundaySent] = await Promise.all([
    sendUpcomingBlocks(admin, now),
    sendEveningReminders(admin, now),
    sendSundayReminders(admin, now),
  ]);

  return {
    upcomingSent,
    eveningSent,
    sundaySent,
  };
}
