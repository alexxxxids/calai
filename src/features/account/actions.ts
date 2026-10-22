'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  ok,
  unauthorized,
  unexpected,
  type ActionResult,
} from '@/lib/action-result';
import { deleteAccount } from './delete-account';
import { exportUserData, type UserExportData } from './export-data';

export async function deleteAccountAction(
  input: unknown
): Promise<ActionResult<{ success: true }>> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  return deleteAccount(supabase, user, input);
}

export async function exportUserDataAction(): Promise<ActionResult<UserExportData>> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    const data = await exportUserData(supabase, user.id);
    return ok(data);
  } catch (err) {
    return unexpected('exportUserDataAction', err);
  }
}
