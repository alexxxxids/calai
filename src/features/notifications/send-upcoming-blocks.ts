import 'server-only';

import { MS_PER_MINUTE } from '@/domain/constants';
import { createUpcomingBlockPayload } from './payloads';
import { sendPushToSubscription, type PushSubscriptionRecord } from './push-sender';
import { UPCOMING_WINDOW_END_MINUTES, UPCOMING_WINDOW_START_MINUTES } from './time-window';
import type { NotificationAdmin } from './types';

interface RawUpcomingBlock {
  readonly id: string;
  readonly user_id: string;
  readonly starts_at: string;
  readonly tasks: {
    readonly id: string;
    readonly task_types: { readonly name: string } | null;
  } | null;
}

async function fetchUpcomingBlocks(admin: NotificationAdmin, now: Date): Promise<RawUpcomingBlock[]> {
  const windowStartIso = new Date(
    now.getTime() + UPCOMING_WINDOW_START_MINUTES * MS_PER_MINUTE,
  ).toISOString();
  const windowEndIso = new Date(
    now.getTime() + UPCOMING_WINDOW_END_MINUTES * MS_PER_MINUTE,
  ).toISOString();

  const { data, error } = await admin
    .from('blocks')
    .select('id, user_id, starts_at, tasks ( id, task_types ( name ) )')
    .eq('status', 'planned')
    .is('notified_at', null)
    .gte('starts_at', windowStartIso)
    .lt('starts_at', windowEndIso);

  if (error) {
    console.error('[send-upcoming-blocks] Error querying upcoming blocks:', error);
    return [];
  }

  return (data ?? []) as unknown as RawUpcomingBlock[];
}

async function deliverBlocks(
  admin: NotificationAdmin,
  blocks: RawUpcomingBlock[],
  userTimezones: Map<string, string>,
  userSubs: Map<string, PushSubscriptionRecord[]>,
): Promise<number> {
  let sentCount = 0;
  for (const block of blocks) {
    const timezone = userTimezones.get(block.user_id) ?? 'Europe/Warsaw';
    const typeName = block.tasks?.task_types?.name ?? null;
    const payload = createUpcomingBlockPayload({
      blockId: block.id,
      typeName,
      startsAt: block.starts_at,
      timezone,
    });

    const subs = userSubs.get(block.user_id) ?? [];
    for (const sub of subs) {
      const result = await sendPushToSubscription(admin, sub, payload);
      if (result.success) {
        sentCount += 1;
      }
    }
  }
  return sentCount;
}

/**
 * Finds blocks starting in [now + 5m, now + 15m), sends notifications,
 * and sets notified_at = now on all processed blocks in batch.
 */
export async function sendUpcomingBlocks(admin: NotificationAdmin, now: Date): Promise<number> {
  const blocks = await fetchUpcomingBlocks(admin, now);
  if (blocks.length === 0) {
    return 0;
  }

  const userIds = Array.from(new Set(blocks.map((b) => b.user_id)));
  const [profilesRes, subsRes] = await Promise.all([
    admin.from('profiles').select('id, timezone').in('id', userIds),
    admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth_secret')
      .in('user_id', userIds),
  ]);

  const userTimezones = new Map<string, string>();
  for (const p of profilesRes.data ?? []) {
    userTimezones.set(p.id, p.timezone);
  }

  const userSubs = new Map<string, PushSubscriptionRecord[]>();
  for (const sub of subsRes.data ?? []) {
    const list = userSubs.get(sub.user_id) ?? [];
    list.push(sub);
    userSubs.set(sub.user_id, list);
  }

  const sentCount = await deliverBlocks(admin, blocks, userTimezones, userSubs);

  // Crucial H-1: Stamp notified_at on all found blocks regardless of subscription count
  const blockIds = blocks.map((b) => b.id);
  await admin.from('blocks').update({ notified_at: now.toISOString() }).in('id', blockIds);

  return sentCount;
}
