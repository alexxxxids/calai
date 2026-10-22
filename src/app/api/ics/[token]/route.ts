import { buildFeed } from '@/features/calendar-sync/build-feed';
import { isValidFeedToken } from '@/features/calendar-sync/schemas';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_SERVER_ERROR = 500;

interface RouteContext {
  params: Promise<{
    token: string;
  }>;
}

/**
 * Public iCal feed endpoint for external subscribers (e.g. Google Calendar).
 * Protected by secret 64-hex token.
 * Token format is verified before touching the database to protect against SSRF/probing.
 */
export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { token } = await context.params;

  if (!isValidFeedToken(token)) {
    return new Response('Not Found', {
      status: HTTP_NOT_FOUND,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const admin = createAdminClient();
  const { data: feed, error: feedError } = await admin
    .from('calendar_feeds')
    .select('user_id')
    .eq('token', token)
    .maybeSingle();

  if (feedError) {
    console.error('[GET /api/ics/[token]] Database error querying calendar feed:', feedError);
    return new Response('Internal Server Error', {
      status: HTTP_INTERNAL_SERVER_ERROR,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (!feed?.user_id) {
    return new Response('Not Found', {
      status: HTTP_NOT_FOUND,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const icsContent = await buildFeed(admin, feed.user_id);
    return new Response(icsContent, {
      status: HTTP_OK,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        'Content-Disposition': 'inline; filename="calendar.ics"',
      },
    });
  } catch (buildError) {
    console.error('[GET /api/ics/[token]] Error generating calendar feed:', buildError);
    return new Response('Internal Server Error', {
      status: HTTP_INTERNAL_SERVER_ERROR,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
