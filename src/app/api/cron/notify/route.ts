import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendDueNotifications } from '@/features/notifications/send-due-notifications';

export const runtime = 'nodejs';

const BEARER_PREFIX = 'Bearer ';

function isValidCronSecret(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
    return false;
  }

  const token = authHeader.slice(BEARER_PREFIX.length);
  const tokenHash = crypto.createHash('sha256').update(token).digest();
  const secretHash = crypto.createHash('sha256').update(expectedSecret).digest();

  return crypto.timingSafeEqual(tokenHash, secretHash);
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = serverEnv().CRON_SECRET;

  if (!isValidCronSecret(authHeader, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await sendDueNotifications(admin, new Date());

  return NextResponse.json({ ok: true, result });
}
