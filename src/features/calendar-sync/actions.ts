'use server';

import { revalidatePath } from 'next/cache';
import {
  fail as badRequest,
  ok,
  unauthorized,
  unexpected,
  type ActionResult,
} from '@/lib/action-result';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getCalendarFeedToken } from './queries';
import {
  addSubscriptionSchema,
  removeSubscriptionSchema,
  syncSubscriptionSchema,
  type AddSubscriptionInput,
  type RemoveSubscriptionInput,
  type SyncSubscriptionInput,
} from './schemas';
import { syncSubscription } from './sync-subscription';

export interface RotateFeedTokenResult {
  readonly token: string;
  readonly url: string;
}

export interface GetFeedTokenResult {
  readonly token: string | null;
  readonly url: string | null;
}

/**
 * Rotates or issues a new secret token for the signed-in user's iCal feed.
 * Old URLs will immediately stop working.
 */
export async function rotateFeedToken(): Promise<ActionResult<RotateFeedTokenResult>> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  const { data, error } = await supabase.rpc('rotate_calendar_feed');
  if (error || !data) {
    return unexpected('rotateFeedToken', error);
  }

  revalidatePath('/settings');

  return ok({
    token: data,
    url: `/api/ics/${data}`,
  });
}

/**
 * Returns the current feed token and relative URL for the signed-in user.
 */
export async function getFeedTokenAction(): Promise<ActionResult<GetFeedTokenResult>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) {
      return unauthorized();
    }

    const token = await getCalendarFeedToken(supabase, user.id);
    return ok({
      token,
      url: token ? `/api/ics/${token}` : null,
    });
  } catch (err) {
    return unexpected('getFeedTokenAction', err);
  }
}

/**
 * Adds a new calendar subscription for the current user and triggers an initial sync.
 */
export async function addSubscription(
  input: AddSubscriptionInput,
): Promise<ActionResult<string>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) {
      return unauthorized();
    }

    const parsed = addSubscriptionSchema.safeParse(input);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane formularza');
    }

    const { data: inserted, error: insertError } = await supabase
      .from('calendar_subscriptions')
      .insert({
        name: parsed.data.name,
        url: parsed.data.url,
        type_id: parsed.data.typeId,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      return unexpected('addSubscription', insertError);
    }

    await syncSubscription(supabase, inserted.id, new Date());

    revalidatePath('/settings');
    revalidatePath('/calendar');

    return ok(inserted.id);
  } catch (err) {
    return unexpected('addSubscription', err);
  }
}

/**
 * Removes a calendar subscription and its associated imported events.
 */
export async function removeSubscription(
  input: RemoveSubscriptionInput,
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) {
      return unauthorized();
    }

    const parsed = removeSubscriptionSchema.safeParse(input);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Nieprawidłowy identyfikator subskrypcji');
    }

    const { error } = await supabase
      .from('calendar_subscriptions')
      .delete()
      .eq('id', parsed.data.subscriptionId)
      .eq('user_id', user.id);

    if (error) {
      return unexpected('removeSubscription', error);
    }

    revalidatePath('/settings');
    revalidatePath('/calendar');

    return ok(undefined);
  } catch (err) {
    return unexpected('removeSubscription', err);
  }
}

/**
 * Triggers manual re-synchronization of external calendar events for a subscription.
 */
export async function syncSubscriptionAction(
  input: SyncSubscriptionInput,
): Promise<ActionResult<number>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) {
      return unauthorized();
    }

    const parsed = syncSubscriptionSchema.safeParse(input);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Nieprawidłowy identyfikator subskrypcji');
    }

    const result = await syncSubscription(supabase, parsed.data.subscriptionId, new Date());

    revalidatePath('/settings');
    revalidatePath('/calendar');

    if (!result.ok) {
      return badRequest(result.error || 'Błąd synchronizacji');
    }

    return ok(result.count ?? 0);
  } catch (err) {
    return unexpected('syncSubscriptionAction', err);
  }
}
