import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncAllSubscriptions } from '@/features/calendar-sync/sync-subscription';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BEARER_PREFIX = 'Bearer ';
const HTTP_UNAUTHORIZED = 401;

function isValidCronSecret(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
    return false;
  }

  const token = authHeader.slice(BEARER_PREFIX.length);
  const tokenHash = crypto.createHash('sha256').update(token).digest();
  const secretHash = crypto.createHash('sha256').update(expectedSecret).digest();

  return crypto.timingSafeEqual(tokenHash, secretHash);
}

async function handleCron(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = serverEnv().CRON_SECRET;

  if (!isValidCronSecret(authHeader, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_UNAUTHORIZED });
  }

  const admin = createAdminClient();
  const result = await syncAllSubscriptions(admin, new Date());

  return NextResponse.json({ ok: true, result });
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleCron(request);
}

export async function GET(request: Request): Promise<NextResponse> {
  return handleCron(request);
}
