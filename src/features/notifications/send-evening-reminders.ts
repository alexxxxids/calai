import 'server-only';

import { instantToLocalDate } from '@/domain/time';
import type { LocalTime } from '@/domain/types';
import { createCloseDayPayload } from './payloads';
import { sendPushToSubscription, type PushSubscriptionRecord } from './push-sender';
import { isEndOfDayWindow } from './time-window';
import type { NotificationAdmin } from './types';

interface CandidateProfile {
  readonly id: string;
  readonly timezone: string;
  readonly day_end: LocalTime;
}

async function fetchCandidateProfiles(
  admin: NotificationAdmin,
  userIds: string[],
): Promise<CandidateProfile[]> {
  const { data, error } = await admin
    .from('profiles')
    .select('id, timezone, day_end')
    .in('id', userIds);

  if (error) {
    console.error('[send-evening-reminders] Error fetching profiles:', error);
    return [];
  }

  return (data ?? []) as CandidateProfile[];
}

async function countUnclosedBlocks(
  admin: NotificationAdmin,
  userId: string,
  nowIso: string,
): Promise<number> {
  const { count, error } = await admin
    .from('blocks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'planned')
    .lte('ends_at', nowIso);

  if (error) {
    console.error('[send-evening-reminders] Error counting unclosed blocks:', error);
    return 0;
  }

  return count ?? 0;
}

function groupSubsByUser(subs: PushSubscriptionRecord[]): Map<string, PushSubscriptionRecord[]> {
  const map = new Map<string, PushSubscriptionRecord[]>();
  for (const sub of subs) {
    const list = map.get(sub.user_id) ?? [];
    list.push(sub);
    map.set(sub.user_id, list);
  }
  return map;
}

async function sendReminderToUser(
  admin: NotificationAdmin,
  profile: CandidateProfile,
  now: Date,
  subs: PushSubscriptionRecord[],
): Promise<number> {
  const nowMs = now.getTime();
  if (!isEndOfDayWindow(nowMs, profile.timezone, profile.day_end)) {
    return 0;
  }

  const unclosed = await countUnclosedBlocks(admin, profile.id, now.toISOString());
  if (unclosed === 0) {
    return 0;
  }

  const localDate = instantToLocalDate(nowMs, profile.timezone);
  const payload = createCloseDayPayload(unclosed, localDate);
  let sent = 0;

  for (const sub of subs) {
    const res = await sendPushToSubscription(admin, sub, payload);
    if (res.success) {
      sent += 1;
    }
  }

  return sent;
}

/**
 * Checks users reaching day_end in their timezone, and sends "Zamknij dzień"
 * reminder if they have unclosed planned blocks.
 */
export async function sendEveningReminders(admin: NotificationAdmin, now: Date): Promise<number> {
  const { data: subsData, error: subsError } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth_secret');

  if (subsError || !subsData || subsData.length === 0) {
    return 0;
  }

  const subsByUser = groupSubsByUser(subsData);
  const profiles = await fetchCandidateProfiles(admin, Array.from(subsByUser.keys()));
  let totalSent = 0;

  for (const profile of profiles) {
    const subs = subsByUser.get(profile.id) ?? [];
    totalSent += await sendReminderToUser(admin, profile, now, subs);
  }

  return totalSent;
}
