import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { serverEnv } from '@/lib/env';
import { supabaseConfig } from './config';

/**
 * Client with the SECRET key: it bypasses Row Level Security completely.
 * Allowed only where there is no signed-in user (cron, iCal feed, account
 * deletion) — see docs/coding-standards.md §5.4. Every query made with it
 * must filter by the owner explicitly.
 */
export function createAdminClient() {
  const { url } = supabaseConfig();
  return createClient<Database>(url, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AdminSupabase = ReturnType<typeof createAdminClient>;
