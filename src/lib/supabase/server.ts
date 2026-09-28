import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';
import { supabaseConfig } from './config';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * It acts as the signed-in user (session from cookies), so RLS applies.
 * Create a new one per request: never share it between users.
 */
export async function createClient() {
  const { url, publishableKey } = supabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. That is fine: proxy.ts
          // refreshes the session on every request before we get here.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
