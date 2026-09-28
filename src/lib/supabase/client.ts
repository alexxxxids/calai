import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';
import { supabaseConfig } from './config';

/**
 * Supabase client for Client Components. Used only for auth screens and for
 * uploading files straight to Storage; everything else goes through the server.
 */
export function createClient() {
  const { url, publishableKey } = supabaseConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
