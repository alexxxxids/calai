'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';
import type * as z from 'zod';

import { zonedToInstant } from '@/domain/time';
import type { LocalDate, LocalTime } from '@/domain/types';
import { estimateFromTopics, topicsToNotes } from '@/features/ai/drafts';
import {
  ConfirmDecompositionSchema,
  ConfirmTimetableSchema,
  type ConfirmDecompositionInput,
  type ConfirmTimetableInput,
} from '@/features/ai/schemas';
import { replanForUser } from '@/features/planner';
import { fail, ok, unexpected, type ActionResult } from '@/lib/action-result';
import { getCurrentUser } from '@/lib/auth';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

const CALENDAR_PATH = '/calendar';
const DEFAULT_TIMEZONE = 'Europe/Warsaw';
const FOREIGN_KEY_VIOLATION_CODE = '23503';
const TIME_SHORT_LENGTH = 5;

const AUTH_REQUIRED_MESSAGE = 'Musisz być zalogowany';
const INVALID_TYPE_MESSAGE = 'Nieprawidłowy typ zadania';

type RecurringEventInsertRow = Database['public']['Tables']['recurring_events']['Insert'];

function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

function normalizeTime(time: string): string {
  return time.length === TIME_SHORT_LENGTH ? `${time}:00` : time;
}

function computeDeadlineUtc(
  deadline: string | null | undefined,
  timezone: string,
): string | null {
  if (!deadline) {
    return null;
  }
  const [datePart, timePart] = deadline.split('T');
  if (!datePart || !timePart) {
    return null;
  }
  // LocalDateTimeSchema guarantees 'YYYY-MM-DDTHH:mm', so parts match LocalDate and LocalTime formats.
  const instant = zonedToInstant(datePart as LocalDate, timePart as LocalTime, timezone);
  return new Date(instant).toISOString();
}

async function resolveUserTimezone(supabase: ServerSupabase, userId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle();

  return data?.timezone ?? DEFAULT_TIMEZONE;
}

async function insertDecomposedTask(
  supabase: ServerSupabase,
  data: ConfirmDecompositionInput,
  deadlineUtc: string | null,
) {
  const estimateMinutes = estimateFromTopics(data.topics);
  const notes = topicsToNotes(data.topics);

  return supabase
    .from('tasks')
    .insert({
      type_id: data.typeId,
      priority: data.priority,
      status: 'active',
      fixation: 'flexible',
      estimate_minutes: estimateMinutes,
      session_minutes: data.sessionMinutes,
      notes,
      deadline: deadlineUtc,
    })
    .select('id')
    .single();
}

export async function confirmDecomposition(
  input: unknown,
): Promise<ActionResult<{ taskId: string }>> {
  const parsed = ConfirmDecompositionSchema.safeParse(input);
  if (!parsed.success) {
    return fail('Nieprawidłowe dane dekompozycji', formatZodErrors(parsed.error));
  }

  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) {
      return fail(AUTH_REQUIRED_MESSAGE);
    }

    const timezone = await resolveUserTimezone(supabase, user.id);
    const deadlineUtc = computeDeadlineUtc(parsed.data.deadline, timezone);

    const { data: task, error: insertError } = await insertDecomposedTask(
      supabase,
      parsed.data,
      deadlineUtc,
    );

    if (insertError || !task) {
      if (insertError?.code === FOREIGN_KEY_VIOLATION_CODE) {
        return fail(INVALID_TYPE_MESSAGE);
      }
      return fail('Nie udało się utworzyć zadania');
    }

    await replanForUser(supabase, user.id, new Date()).catch(() => {});
    revalidatePath(CALENDAR_PATH);
    return ok({ taskId: task.id });
  } catch (err) {
    return unexpected('confirmDecomposition', err);
  }
}

function mapTimetableEvents(data: ConfirmTimetableInput): RecurringEventInsertRow[] {
  return data.events.map((event) => ({
    title: event.title,
    type_id: data.typeId,
    weekday: event.weekday,
    start_time: normalizeTime(event.startTime),
    end_time: normalizeTime(event.endTime),
    valid_from: data.validFrom,
    valid_until: data.validUntil,
  }));
}

export async function confirmTimetable(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  const parsed = ConfirmTimetableSchema.safeParse(input);
  if (!parsed.success) {
    return fail('Nieprawidłowe dane planu lekcji', formatZodErrors(parsed.error));
  }

  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) {
      return fail(AUTH_REQUIRED_MESSAGE);
    }

    const rows = mapTimetableEvents(parsed.data);
    const { error: insertError } = await supabase.from('recurring_events').insert(rows);

    if (insertError) {
      if (insertError.code === FOREIGN_KEY_VIOLATION_CODE) {
        return fail(INVALID_TYPE_MESSAGE);
      }
      return fail('Nie udało się zapisać planu lekcji');
    }

    await replanForUser(supabase, user.id, new Date()).catch(() => {});
    revalidatePath(CALENDAR_PATH);
    return ok({ count: rows.length });
  } catch (err) {
    return unexpected('confirmTimetable', err);
  }
}
