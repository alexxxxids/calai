import { NextResponse } from 'next/server';

import { instantToLocalDate } from '@/domain/time';
import { toTimetableDraft } from '@/features/ai/drafts';
import { callGemini } from '@/features/ai/gateway';
import { TIMETABLE_SYSTEM, timetablePrompt } from '@/features/ai/prompts';
import { AI_FAILURE } from '@/features/ai/results';
import {
  TimetableRequestSchema,
  type TimetableRequest,
  TimetableSchema,
} from '@/features/ai/schemas';
import { AI_UPLOAD_BUCKET, ownUploadMimeType, type AiMimeType } from '@/features/ai/uploads';
import { getCurrentUser } from '@/lib/auth';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';

export const maxDuration = 120;

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_SERVER_ERROR = 500;

const DEFAULT_TIMEZONE = 'Europe/Warsaw';
const QUOTA_LIMIT_CODE = 'P0001';
const QUOTA_LIMIT_MESSAGE = 'ai_daily_limit_reached';

async function reserveQuota(supabase: ServerSupabase) {
  const { data: requestId, error: rpcError } = await supabase.rpc('start_ai_request', {
    p_kind: 'timetable',
  });

  if (rpcError) {
    const isLimitReached =
      rpcError.code === QUOTA_LIMIT_CODE || rpcError.message.includes(QUOTA_LIMIT_MESSAGE);
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: isLimitReached ? 'Limit na dziś wyczerpany' : 'Błąd rezerwacji limitu AI' },
        { status: isLimitReached ? HTTP_TOO_MANY_REQUESTS : HTTP_INTERNAL_SERVER_ERROR },
      ),
    };
  }

  return { ok: true as const, requestId };
}

async function recordAiFailure(
  supabase: ServerSupabase,
  requestId: string,
  usage?: {
    model?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
  } | null,
) {
  await supabase
    .from('ai_requests')
    .update({
      status: 'failed',
      model: usage?.model ?? null,
      input_tokens: usage?.inputTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
    })
    .eq('id', requestId);
}

async function recordAiSuccess(
  supabase: ServerSupabase,
  requestId: string,
  usage: { model: string; inputTokens: number | null; outputTokens: number | null },
) {
  await supabase
    .from('ai_requests')
    .update({
      status: 'succeeded',
      model: usage.model,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    })
    .eq('id', requestId);
}

async function executeTimetable(params: {
  supabase: ServerSupabase;
  userId: string;
  requestId: string;
  data: TimetableRequest;
  mimeType: AiMimeType;
}) {
  const { supabase, userId, requestId, data, mimeType } = params;
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(AI_UPLOAD_BUCKET)
    .download(data.path);

  if (downloadError || !fileBlob) {
    await recordAiFailure(supabase, requestId);
    return NextResponse.json({ error: 'Nie udało się pobrać pliku' }, { status: HTTP_BAD_REQUEST });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle();
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const today = instantToLocalDate(Date.now(), timezone);
  const prompt = timetablePrompt(data.description ?? '');

  const base64 = Buffer.from(await fileBlob.arrayBuffer()).toString('base64');
  const aiResult = await callGemini({
    schema: TimetableSchema,
    system: TIMETABLE_SYSTEM,
    prompt,
    files: [{ mimeType, data: base64 }],
  });

  if (!aiResult.ok) {
    await recordAiFailure(supabase, requestId, aiResult.usage);
    const failure = AI_FAILURE[aiResult.reason];
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }

  await recordAiSuccess(supabase, requestId, aiResult.usage);
  return NextResponse.json(toTimetableDraft(aiResult.data, today), { status: HTTP_OK });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_UNAUTHORIZED });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe dane żądania' }, { status: HTTP_BAD_REQUEST });
  }

  const parsed = TimetableRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nieprawidłowe dane żądania' }, { status: HTTP_BAD_REQUEST });
  }

  const data = parsed.data;
  const mimeType = ownUploadMimeType(data.path, user.id);
  if (!mimeType) {
    return NextResponse.json({ error: 'Nieprawidłowa ścieżka pliku' }, { status: HTTP_BAD_REQUEST });
  }

  const quota = await reserveQuota(supabase);
  if (!quota.ok) {
    return quota.response;
  }

  try {
    return await executeTimetable({
      supabase,
      userId: user.id,
      requestId: quota.requestId,
      data,
      mimeType,
    });
  } finally {
    await supabase.storage.from(AI_UPLOAD_BUCKET).remove([data.path]).catch(() => {});
  }
}
