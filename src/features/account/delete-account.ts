import 'server-only';

import { createAdminClient, type AdminSupabase } from '@/lib/supabase/admin';
import type { ServerSupabase } from '@/lib/supabase/server';
import type { CurrentUser } from '@/lib/auth';
import {
  ok,
  invalidInput,
  unexpected,
  type ActionResult,
} from '@/lib/action-result';
import { DeleteAccountSchema } from './schemas';

async function cleanUserAiUploads(admin: AdminSupabase, userId: string): Promise<void> {
  const { data: files, error: listError } = await admin.storage.from('ai-uploads').list(userId);
  if (listError) {
    throw new Error(`Nie udało się wylistować plików w ai-uploads: ${listError.message}`);
  }
  const paths = (files ?? []).map((file) => `${userId}/${file.name}`);
  if (paths.length > 0) {
    const { error: removeError } = await admin.storage.from('ai-uploads').remove(paths);
    if (removeError) {
      throw new Error(`Nie udało się usunąć plików z ai-uploads: ${removeError.message}`);
    }
  }
}

export async function deleteAccount(
  supabase: ServerSupabase,
  user: CurrentUser,
  input: unknown
): Promise<ActionResult<{ success: true }>> {
  const parsed = DeleteAccountSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const admin = createAdminClient();

  try {
    await cleanUserAiUploads(admin, user.id);
  } catch (err) {
    return unexpected('deleteAccount/storage', err);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return unexpected('deleteAccount/deleteUser', deleteError);
  }

  try {
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) {
      console.error('[deleteAccount] Local signOut failed after user deletion:', signOutError);
    }
  } catch (err) {
    console.error('[deleteAccount] Local signOut failed after user deletion:', err);
  }

  return ok({ success: true });
}
