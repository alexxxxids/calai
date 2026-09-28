import 'server-only';
import { redirect } from 'next/navigation';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';

export interface CurrentUser {
  id: string;
  email: string | null;
}

/**
 * The signed-in user, verified. `getClaims()` checks the JWT signature
 * (never trust `getSession()` on the server: it only reads the cookie).
 */
export async function getCurrentUser(supabase: ServerSupabase): Promise<CurrentUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    return null;
  }
  const email = typeof data.claims.email === 'string' ? data.claims.email : null;
  return { id: data.claims.sub, email };
}

/**
 * For layouts and pages behind the login: the verified user, or a redirect to /login.
 * Every page checks on its own instead of trusting its layout: Next.js does not re-render
 * a layout when you move between the pages inside it.
 * Server Actions do not use this: they return `unauthorized()` (docs/coding-standards.md §4.2).
 */
export async function requireUser(): Promise<{ supabase: ServerSupabase; user: CurrentUser }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    redirect('/login');
  }
  return { supabase, user };
}

/** For the login and sign-up pages: a signed-in user has nothing to do there and goes to the app. */
export async function requireGuest(): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (user) {
    redirect('/calendar');
  }
}
