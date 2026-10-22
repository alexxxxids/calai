import 'server-only';

import { instantToLocalDate, weekStart } from '@/domain/time';
import { createWeeklyReflectionPayload } from './payloads';
import { sendPushToSubscription, type PushSubscriptionRecord } from './push-sender';
import { isSundayReflectionWindow } from './time-window';
import type { NotificationAdmin } from './types';

interface CandidateProfile {
  readonly id: string;
  readonly timezone: string;
}

async function fetchCandidateProfiles(
  admin: NotificationAdmin,
  userIds: string[],
): Promise<CandidateProfile[]> {
  const { data, error } = await admin
    .from('profiles')
    .select('id, timezone')
    .in('id', userIds)
    .in('reflection_level', ['analytic', 'strategic']);

  if (error) {
    console.error('[send-sunday-reminders] Error fetching profiles:', error);
    return [];
  }

  return (data ?? []) as CandidateProfile[];
}

async function hasWeeklyReflection(
  admin: NotificationAdmin,
  userId: string,
  weekStartDate: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('weekly_reflections')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start', weekStartDate)
    .maybeSingle();

  if (error) {
    console.error('[send-sunday-reminders] Error querying weekly reflections:', error);
    // Safe fallback (H-5): treat as filled to avoid spamming the user on database error
    return true;
  }

  return data !== null;
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

async function sendSundayReminderToUser(
  admin: NotificationAdmin,
  profile: CandidateProfile,
  nowMs: number,
  subs: PushSubscriptionRecord[],
): Promise<number> {
  if (!isSundayReflectionWindow(nowMs, profile.timezone)) {
    return 0;
  }

  const localDate = instantToLocalDate(nowMs, profile.timezone);
  const monday = weekStart(localDate);
  const filled = await hasWeeklyReflection(admin, profile.id, monday);
  if (filled) {
    return 0;
  }

  const payload = createWeeklyReflectionPayload(monday);
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
 * Checks Sunday 19:00 window for users with level >= analytic,
 * sending a reminder if this week's questionnaire is not yet filled.
 */
export async function sendSundayReminders(admin: NotificationAdmin, now: Date): Promise<number> {
  const { data: subsData, error: subsError } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth_secret');

  if (subsError || !subsData || subsData.length === 0) {
    return 0;
  }

  const subsByUser = groupSubsByUser(subsData);
  const profiles = await fetchCandidateProfiles(admin, Array.from(subsByUser.keys()));
  const nowMs = now.getTime();
  let totalSent = 0;

  for (const profile of profiles) {
    const subs = subsByUser.get(profile.id) ?? [];
    totalSent += await sendSundayReminderToUser(admin, profile, nowMs, subs);
  }

  return totalSent;
}
