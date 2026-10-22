'use server';

import { ok, unauthorized, unexpected, type ActionResult } from '@/lib/action-result';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getCalendarFeedToken } from './queries';

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

  return ok({
    token: data,
    url: `/api/ics/${data}`,
  });
}

/**
 * Returns the current feed token and relative URL for the signed-in user.
 */
export async function getFeedTokenAction(): Promise<ActionResult<GetFeedTokenResult>> {
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
}
