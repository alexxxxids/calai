'use server';

import { revalidatePath } from 'next/cache';

import {
  fail,
  invalidInput,
  ok,
  unauthorized,
  unexpected,
  type ActionResult,
} from '@/lib/action-result';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

import { replanForUser } from '../planner';
import {
  CreateRecurringEventsSchema,
  DeleteRecurringEventSchema,
  type CreateRecurringEventInput,
} from './schemas';

const CALENDAR_PATH = '/calendar';
const TIME_SHORT_LENGTH = 5;
const FOREIGN_KEY_VIOLATION_CODE = '23503';

type RecurringEventInsertRow = Database['public']['Tables']['recurring_events']['Insert'];

function normalizeInput(input: unknown): unknown {
  if (Array.isArray(input)) {
    return { events: input };
  }
  if (typeof input === 'object' && input !== null && !('events' in input)) {
    return { events: [input] };
  }
  return input;
}

function normalizeTime(time: string): string {
  return time.length === TIME_SHORT_LENGTH ? `${time}:00` : time;
}

function mapEventToInsertRow(event: CreateRecurringEventInput): RecurringEventInsertRow {
  return {
    title: event.title,
    type_id: event.typeId,
    weekday: event.weekday,
    start_time: normalizeTime(event.startTime),
    end_time: normalizeTime(event.endTime),
    valid_from: event.validFrom,
    valid_until: event.validUntil ?? null,
  };
}

export async function createRecurringEvents(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  const normalized = normalizeInput(input);
  const parsed = CreateRecurringEventsSchema.safeParse(normalized);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) {
      return unauthorized();
    }

    const rows = parsed.data.events.map(mapEventToInsertRow);
    const { error: insertError } = await supabase.from('recurring_events').insert(rows);

    if (insertError) {
      if (insertError.code === FOREIGN_KEY_VIOLATION_CODE) {
        return fail('Nieprawidłowy typ zadania', {
          typeId: ['Nieprawidłowy typ zadania'],
        });
      }
      return fail('Nie udało się zapisać powtarzających się wydarzeń');
    }

    await replanForUser(supabase, user.id, new Date());
    revalidatePath(CALENDAR_PATH);
    return ok({ count: rows.length });
  } catch (err) {
    return unexpected('createRecurringEvents', err);
  }
}

export async function deleteRecurringEvent(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = DeleteRecurringEventSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) {
      return unauthorized();
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .from('recurring_events')
      .delete()
      .eq('id', parsed.data.id)
      .eq('user_id', user.id)
      .select('id');

    if (deleteError) {
      return fail('Nie udało się usunąć powtarzającego się wydarzenia');
    }

    if (!deletedRows || deletedRows.length === 0) {
      return fail('Nie znaleziono powtarzającego się wydarzenia');
    }

    await replanForUser(supabase, user.id, new Date());
    revalidatePath(CALENDAR_PATH);
    return ok({ id: parsed.data.id });
  } catch (err) {
    return unexpected('deleteRecurringEvent', err);
  }
}
