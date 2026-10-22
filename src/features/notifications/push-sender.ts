import 'server-only';

import webpush, { WebPushError } from 'web-push';
import type { NotificationPayload } from './schemas';
import type { NotificationAdmin } from './types';
import { ensureVapidConfigured } from './vapid';

const GONE_STATUS = 410;
const NOT_FOUND_STATUS = 404;

export interface PushSubscriptionRecord {
  readonly id: string;
  readonly user_id: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth_secret: string;
}

export interface PushSendResult {
  readonly success: boolean;
  readonly pruned: boolean;
}

/**
 * Sends a web-push notification to a single browser subscription.
 * If the push service responds with 404 or 410 (expired/unregistered),
 * the subscription is automatically pruned from the database.
 */
export async function sendPushToSubscription(
  admin: NotificationAdmin,
  subscription: PushSubscriptionRecord,
  payload: NotificationPayload,
): Promise<PushSendResult> {
  if (!ensureVapidConfigured()) {
    console.warn('[push-sender] VAPID keys not configured, skipping push delivery');
    return { success: false, pruned: false };
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth_secret,
    },
  };

  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    return { success: true, pruned: false };
  } catch (error: unknown) {
    if (error instanceof WebPushError) {
      if (error.statusCode === NOT_FOUND_STATUS || error.statusCode === GONE_STATUS) {
        const { error: deleteError } = await admin
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
        if (deleteError) {
          console.error('[push-sender] Failed to prune dead subscription:', deleteError);
        }
        return { success: false, pruned: true };
      }
      console.warn(`[push-sender] WebPushError ${error.statusCode} for endpoint: ${error.endpoint}`);
    } else {
      console.warn('[push-sender] Unexpected error sending push notification:', error);
    }
    return { success: false, pruned: false };
  }
}
