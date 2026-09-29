import 'server-only';

import type { ServerSupabase } from '@/lib/supabase/server';

import type {
  PlannerBlockRow,
  PlannerData,
  PlannerExternalEventRow,
  PlannerProfile,
  PlannerRecurringRow,
  PlannerReflectionRow,
  PlannerSubscriptionRow,
  PlannerTaskRow,
  PlannerTaskType,
} from './types';

interface QueryResult<T> {
  readonly data: T | null;
  readonly error: { readonly message: string } | null;
}

function unwrapProfile(result: QueryResult<PlannerProfile>): PlannerProfile {
  if (result.error) {
    throw new Error(`Błąd pobierania profilu: ${result.error.message}`);
  }
  if (!result.data) {
    throw new Error('Nie znaleziono profilu użytkownika');
  }
  return result.data;
}

function unwrapList<T>(result: QueryResult<readonly T[]>, entityName: string): readonly T[] {
  if (result.error) {
    throw new Error(`Błąd pobierania ${entityName}: ${result.error.message}`);
  }
  return result.data ?? [];
}

function unwrapReflection(
  result: QueryResult<PlannerReflectionRow>,
): PlannerReflectionRow | null {
  if (result.error) {
    throw new Error(`Błąd pobierania refleksji: ${result.error.message}`);
  }
  return result.data;
}

async function queryCoreEntities(supabase: ServerSupabase, userId: string) {
  return Promise.all([
    supabase
      .from('profiles')
      .select('id, timezone, day_start, day_end, daily_energy_limit, reflection_level')
      .eq('id', userId)
      .single(),
    supabase
      .from('task_types')
      .select('id, name, energy, is_rest, is_one_off')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('tasks')
      .select(
        'id, type_id, notes, priority, fixation, estimate_minutes, session_minutes, deadline, created_at, status',
      )
      .eq('user_id', userId),
    supabase
      .from('blocks')
      .select(
        'id, task_id, starts_at, ends_at, work_minutes, status, source, pinned, actual_minutes, closed_at',
      )
      .eq('user_id', userId),
  ]);
}

async function queryEventEntities(supabase: ServerSupabase, userId: string) {
  return Promise.all([
    supabase
      .from('recurring_events')
      .select('id, type_id, weekday, start_time, end_time, valid_from, valid_until')
      .eq('user_id', userId),
    supabase
      .from('calendar_subscriptions')
      .select('id, type_id')
      .eq('user_id', userId),
    supabase
      .from('external_events')
      .select('id, subscription_id, starts_at, ends_at, title')
      .eq('user_id', userId),
    supabase
      .from('weekly_reflections')
      .select('week_start, fatigue, stress, focus, distractions')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
}

export async function loadPlannerData(
  supabase: ServerSupabase,
  userId: string,
): Promise<PlannerData> {
  const [
    [profileRes, taskTypesRes, tasksRes, blocksRes],
    [recurringRes, subsRes, eventsRes, reflectionRes],
  ] = await Promise.all([
    queryCoreEntities(supabase, userId),
    queryEventEntities(supabase, userId),
  ]);

  return {
    profile: unwrapProfile(profileRes),
    taskTypes: unwrapList<PlannerTaskType>(taskTypesRes, 'typów zadań'),
    tasks: unwrapList<PlannerTaskRow>(tasksRes, 'zadań'),
    blocks: unwrapList<PlannerBlockRow>(blocksRes, 'bloków'),
    recurringEvents: unwrapList<PlannerRecurringRow>(recurringRes, 'powtarzających się wydarzeń'),
    subscriptions: unwrapList<PlannerSubscriptionRow>(subsRes, 'subskrypcji kalendarza'),
    externalEvents: unwrapList<PlannerExternalEventRow>(eventsRes, 'wydarzeń zewnętrznych'),
    latestReflection: unwrapReflection(reflectionRes),
  };
}
