'use server';

import {
  fail,
  invalidInput,
  ok,
  unauthorized,
  unexpected,
  type ActionResult,
} from '@/lib/action-result';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  SubscribePushSchema,
  UnsubscribePushSchema,
} from './schemas';

/**
 * Registers or updates a push notification subscription for the signed-in user.
 * Uses security-definer RPC `claim_push_subscription` to claim the unique endpoint.
 */
export async function subscribePush(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = SubscribePushSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  const { data, error } = await supabase.rpc('claim_push_subscription', {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.p256dh,
    p_auth_secret: parsed.data.authSecret,
    p_user_agent: parsed.data.userAgent ?? '',
  });

  if (error) {
    return fail(`Nie udało się zapisać subskrypcji: ${error.message}`);
  }

  return ok({ id: data });
}

/**
 * Removes this browser's push subscription from the database.
 * Protected by Row Level Security: user can only delete their own subscription.
 */
export async function unsubscribePush(
  input: unknown,
): Promise<ActionResult<{ success: boolean }>> {
  const parsed = UnsubscribePushSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', parsed.data.endpoint);

  if (error) {
    return unexpected('unsubscribePush', error);
  }

  return ok({ success: true });
}

/**
 * Checks whether the current signed-in user owns the push subscription on this endpoint.
 * Prevents account confusion on shared school lab computers (H-2).
 */
export async function isCurrentDeviceSubscribed(
  input: unknown,
): Promise<ActionResult<{ subscribed: boolean }>> {
  const parsed = UnsubscribePushSchema.safeParse(input);
  if (!parsed.success) {
    return ok({ subscribed: false });
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', parsed.data.endpoint)
    .maybeSingle();

  if (error) {
    return unexpected('isCurrentDeviceSubscribed', error);
  }

  return ok({ subscribed: data !== null });
}
