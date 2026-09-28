import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database.types';
import { supabaseConfig } from './config';

/** Pages that must stay reachable without a session. */
const PUBLIC_PAGES = [
  '/',
  '/privacy',
  '/login',
  '/register',
  '/verify',
  '/forgot-password',
  '/reset-password',
];

/**
 * Route handlers answer for themselves: each checks the session (or the cron secret, or the
 * feed token) and replies with JSON, e.g. 401. A redirect to the HTML login page would reach
 * fetch() in the browser as "200 + HTML" instead of an error it can understand.
 */
const API_PREFIX = '/api/';

function needsLogin(pathname: string): boolean {
  return !PUBLIC_PAGES.includes(pathname) && !pathname.startsWith(API_PREFIX);
}

/**
 * Runs before every matched request (see src/proxy.ts): refreshes the Supabase
 * session cookies and sends anonymous visitors of private pages to /login.
 *
 * This is a convenience, not the security boundary: every Server Action and
 * Route Handler checks the user again, and RLS guards the data itself.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { url, publishableKey } = supabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cache-Control headers from Supabase: a response carrying a session
        // must never be stored by a CDN and served to someone else.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not put code between createServerClient and getClaims(): the call
  // below is what refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  if (!isSignedIn && needsLogin(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
