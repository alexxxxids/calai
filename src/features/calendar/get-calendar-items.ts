import 'server-only';

import type { ServerSupabase } from '@/lib/supabase/server';

import {
  expandRecurringToCalendarEvents,
  mapBlockToCalendarEvent,
  mapExternalToCalendarEvent,
} from './event-mappers';
import type {
  CalendarEventItem,
  CalendarRange,
  RawBlockWithRelations,
  RawExternalWithRelations,
  RawRecurringWithRelations,
  TaskTypeItem,
} from './types';

export const DEFAULT_TIMEZONE = 'Europe/Warsaw';

export async function fetchProfileTimezone(
  supabase: ServerSupabase,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Błąd pobierania strefy czasowej: ${error.message}`);
  }

  return data?.timezone ?? DEFAULT_TIMEZONE;
}

export async function fetchTaskTypes(
  supabase: ServerSupabase,
  userId: string,
): Promise<TaskTypeItem[]> {
  const { data, error } = await supabase
    .from('task_types')
    .select('id, name, color, energy, is_rest')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Błąd pobierania typów zadań: ${error.message}`);
  }

  return (data ?? []) as unknown as TaskTypeItem[];
}

export async function fetchBlocks(
  supabase: ServerSupabase,
  userId: string,
  range: CalendarRange,
): Promise<RawBlockWithRelations[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select(
      'id, task_id, starts_at, ends_at, work_minutes, status, source, pinned, tasks(id, fixation, type_id, task_types(id, name, color, energy))',
    )
    .eq('user_id', userId)
    .lt('starts_at', range.end)
    .gt('ends_at', range.start);

  if (error) {
    throw new Error(`Błąd pobierania bloków: ${error.message}`);
  }

  return (data ?? []) as unknown as RawBlockWithRelations[];
}

export async function fetchRecurringEvents(
  supabase: ServerSupabase,
  userId: string,
): Promise<RawRecurringWithRelations[]> {
  const { data, error } = await supabase
    .from('recurring_events')
    .select(
      'id, title, type_id, weekday, start_time, end_time, valid_from, valid_until, task_types(id, name, color, energy)',
    )
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Błąd pobierania powtarzających się wydarzeń: ${error.message}`);
  }

  return (data ?? []) as unknown as RawRecurringWithRelations[];
}

export async function fetchExternalEvents(
  supabase: ServerSupabase,
  userId: string,
  range: CalendarRange,
): Promise<RawExternalWithRelations[]> {
  const { data, error } = await supabase
    .from('external_events')
    .select(
      'id, title, starts_at, ends_at, subscription_id, calendar_subscriptions(id, type_id, task_types(id, name, color, energy))',
    )
    .eq('user_id', userId)
    .lt('starts_at', range.end)
    .gt('ends_at', range.start);

  if (error) {
    throw new Error(`Błąd pobierania wydarzeń zewnętrznych: ${error.message}`);
  }

  return (data ?? []) as unknown as RawExternalWithRelations[];
}

function compareCalendarEvents(a: CalendarEventItem, b: CalendarEventItem): number {
  return (
    Date.parse(a.start) - Date.parse(b.start) ||
    Date.parse(a.end) - Date.parse(b.end) ||
    a.id.localeCompare(b.id)
  );
}

export async function getCalendarItems(
  supabase: ServerSupabase,
  userId: string,
  range: CalendarRange,
): Promise<CalendarEventItem[]> {
  const [timezone, taskTypes, blocks, recurring, external] = await Promise.all([
    fetchProfileTimezone(supabase, userId),
    fetchTaskTypes(supabase, userId),
    fetchBlocks(supabase, userId, range),
    fetchRecurringEvents(supabase, userId),
    fetchExternalEvents(supabase, userId, range),
  ]);

  const restType = taskTypes.find((t) => t.is_rest);
  const mappedBlocks = blocks.map((b) => mapBlockToCalendarEvent(b, restType));
  const mappedRecurring = recurring.flatMap((r) =>
    expandRecurringToCalendarEvents(r, range, timezone),
  );
  const mappedExternal = external.map((e) => mapExternalToCalendarEvent(e));

  const items = [...mappedBlocks, ...mappedRecurring, ...mappedExternal];
  return items.sort(compareCalendarEvents);
}
