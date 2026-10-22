import 'server-only';

import type { ServerSupabase } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

export const EXPORT_DATA_VERSION = 1 as const;

export interface UserExportData {
  readonly version: typeof EXPORT_DATA_VERSION;
  readonly exportedAt: string;
  readonly userId: string;
  readonly profiles: Database['public']['Tables']['profiles']['Row'][];
  readonly task_types: Database['public']['Tables']['task_types']['Row'][];
  readonly tasks: Database['public']['Tables']['tasks']['Row'][];
  readonly blocks: Database['public']['Tables']['blocks']['Row'][];
  readonly recurring_events: Database['public']['Tables']['recurring_events']['Row'][];
  readonly habits: Database['public']['Tables']['habits']['Row'][];
  readonly habit_checks: Database['public']['Tables']['habit_checks']['Row'][];
  readonly weekly_reflections: Database['public']['Tables']['weekly_reflections']['Row'][];
  readonly monthly_reflections: Database['public']['Tables']['monthly_reflections']['Row'][];
  readonly ai_requests: Database['public']['Tables']['ai_requests']['Row'][];
  readonly push_subscriptions: Database['public']['Tables']['push_subscriptions']['Row'][];
  readonly calendar_feeds: Database['public']['Tables']['calendar_feeds']['Row'][];
  readonly calendar_subscriptions: Database['public']['Tables']['calendar_subscriptions']['Row'][];
  readonly external_events: Database['public']['Tables']['external_events']['Row'][];
}

export type RawExportRecords = {
  readonly [K in keyof Omit<UserExportData, 'version' | 'exportedAt' | 'userId'>]?: readonly UserExportData[K][number][];
};

function sortById<T extends { readonly id: string }>(items?: readonly T[]): T[] {
  return items ? [...items].sort((a, b) => a.id.localeCompare(b.id)) : [];
}

function sortByCreatedAt<T extends { readonly created_at: string; readonly id?: string }>(
  items?: readonly T[]
): T[] {
  return items
    ? [...items].sort(
        (a, b) =>
          a.created_at.localeCompare(b.created_at) ||
          (a.id !== undefined && b.id !== undefined ? a.id.localeCompare(b.id) : 0)
      )
    : [];
}

function sortByStartsAt<T extends { readonly starts_at: string; readonly id?: string }>(
  items?: readonly T[]
): T[] {
  return items
    ? [...items].sort(
        (a, b) =>
          a.starts_at.localeCompare(b.starts_at) ||
          (a.id !== undefined && b.id !== undefined ? a.id.localeCompare(b.id) : 0)
      )
    : [];
}

function sortByDay<T extends { readonly day: string; readonly habit_id?: string }>(
  items?: readonly T[]
): T[] {
  return items
    ? [...items].sort(
        (a, b) =>
          a.day.localeCompare(b.day) ||
          (a.habit_id !== undefined && b.habit_id !== undefined
            ? a.habit_id.localeCompare(b.habit_id)
            : 0)
      )
    : [];
}

export function buildUserExport(
  records: RawExportRecords,
  userId: string,
  exportedAt: string = new Date().toISOString()
): UserExportData {
  return {
    version: EXPORT_DATA_VERSION,
    exportedAt,
    userId,
    profiles: sortById(records.profiles),
    task_types: sortByCreatedAt(records.task_types),
    tasks: sortByCreatedAt(records.tasks),
    blocks: sortByStartsAt(records.blocks),
    recurring_events: sortByCreatedAt(records.recurring_events),
    habits: sortByCreatedAt(records.habits),
    habit_checks: sortByDay(records.habit_checks),
    weekly_reflections: sortByCreatedAt(records.weekly_reflections),
    monthly_reflections: sortByCreatedAt(records.monthly_reflections),
    ai_requests: sortByCreatedAt(records.ai_requests),
    push_subscriptions: sortByCreatedAt(records.push_subscriptions),
    calendar_feeds: sortByCreatedAt(records.calendar_feeds),
    calendar_subscriptions: sortByCreatedAt(records.calendar_subscriptions),
    external_events: sortByStartsAt(records.external_events),
  };
}

async function fetchTableRows<T>(
  tableName: string,
  query: PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    throw new Error(`Nie udało się wyeksportować danych: ${tableName}`);
  }
  return (data ?? []) as T[];
}

async function fetchCoreUserData(supabase: ServerSupabase, userId: string) {
  const [profiles, task_types, tasks, blocks] = await Promise.all([
    fetchTableRows(
      'profiles',
      supabase.from('profiles').select('*').eq('id', userId).order('id')
    ),
    fetchTableRows(
      'task_types',
      supabase
        .from('task_types')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
    ),
    fetchTableRows(
      'tasks',
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
    ),
    fetchTableRows(
      'blocks',
      supabase.from('blocks').select('*').eq('user_id', userId).order('starts_at')
    ),
  ]);

  return { profiles, task_types, tasks, blocks };
}

async function fetchHabitData(supabase: ServerSupabase, userId: string) {
  const [recurring_events, habits, habit_checks] = await Promise.all([
    fetchTableRows(
      'recurring_events',
      supabase
        .from('recurring_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
    ),
    fetchTableRows(
      'habits',
      supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
    ),
    fetchTableRows(
      'habit_checks',
      supabase.from('habit_checks').select('*').eq('user_id', userId).order('day')
    ),
  ]);

  return { recurring_events, habits, habit_checks };
}

async function fetchReflectionData(supabase: ServerSupabase, userId: string) {
  const [weekly_reflections, monthly_reflections, ai_requests, push_subscriptions] =
    await Promise.all([
      fetchTableRows(
        'weekly_reflections',
        supabase
          .from('weekly_reflections')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
      ),
      fetchTableRows(
        'monthly_reflections',
        supabase
          .from('monthly_reflections')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
      ),
      fetchTableRows(
        'ai_requests',
        supabase
          .from('ai_requests')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
      ),
      fetchTableRows(
        'push_subscriptions',
        supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
      ),
    ]);

  return { weekly_reflections, monthly_reflections, ai_requests, push_subscriptions };
}

async function fetchCalendarData(supabase: ServerSupabase, userId: string) {
  const [calendar_feeds, calendar_subscriptions, external_events] =
    await Promise.all([
      fetchTableRows(
        'calendar_feeds',
        supabase
          .from('calendar_feeds')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
      ),
      fetchTableRows(
        'calendar_subscriptions',
        supabase
          .from('calendar_subscriptions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
      ),
      fetchTableRows(
        'external_events',
        supabase
          .from('external_events')
          .select('*')
          .eq('user_id', userId)
          .order('starts_at')
      ),
    ]);

  return { calendar_feeds, calendar_subscriptions, external_events };
}

export async function exportUserData(
  supabase: ServerSupabase,
  userId: string
): Promise<UserExportData> {
  const [core, habit, reflection, calendar] = await Promise.all([
    fetchCoreUserData(supabase, userId),
    fetchHabitData(supabase, userId),
    fetchReflectionData(supabase, userId),
    fetchCalendarData(supabase, userId),
  ]);

  return buildUserExport(
    {
      ...core,
      ...habit,
      ...reflection,
      ...calendar,
    },
    userId
  );
}
