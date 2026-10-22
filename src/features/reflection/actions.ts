'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { getProfile } from '@/features/profile/queries';
import { replanForUser } from '@/features/planner';
import {
  type ActionResult,
  fail,
  invalidInput,
  ok,
  unauthorized,
  unexpected,
} from '@/lib/action-result';
import {
  canAccessMonthlyReflection,
  canAccessWeeklyReflection,
  isAllowedMonth,
  isAllowedWeek,
} from './rules';
import {
  MonthlyReflectionSchema,
  WeeklyReflectionSchema,
  type MonthlyReflectionInput,
  type WeeklyReflectionInput,
} from './schemas';

const CALENDAR_PATH = '/calendar';
const REFLECTION_PATH = '/reflection';

async function getVerifiedContext() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return { errorResult: unauthorized() };
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return { errorResult: fail('Nie znaleziono profilu użytkownika.') };
  }

  return { supabase, user, profile };
}

async function triggerPlannerReplan(
  supabase: ServerSupabase,
  userId: string,
  now: Date,
): Promise<ActionResult<never> | null> {
  try {
    await replanForUser(supabase, userId, now);
    return null;
  } catch (replanError) {
    if (
      replanError instanceof Error &&
      replanError.message === 'Plan się zmienił, spróbuj ponownie'
    ) {
      return fail('Plan się zmienił, spróbuj ponownie');
    }
    return unexpected('saveWeeklyReflection:replan', replanError);
  }
}

async function persistWeeklyReflection(
  supabase: ServerSupabase,
  data: WeeklyReflectionInput,
  now: Date,
) {
  const { error } = await supabase.from('weekly_reflections').upsert(
    {
      week_start: data.weekStart,
      fatigue: data.fatigue,
      stress: data.stress,
      focus: data.focus,
      distractions: data.distractions,
      note: data.note,
      updated_at: now.toISOString(),
    },
    { onConflict: 'user_id,week_start' },
  );

  return error;
}

export async function saveWeeklyReflection(
  input: unknown,
): Promise<ActionResult<{ weekStart: string }>> {
  const parsed = WeeklyReflectionSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  try {
    const context = await getVerifiedContext();
    if ('errorResult' in context) {
      return context.errorResult as ActionResult<{ weekStart: string }>;
    }
    const { supabase, user, profile } = context;

    if (!canAccessWeeklyReflection(profile.reflection_level)) {
      return fail('Poziom refleksji nie pozwala na wypełnienie ankiety tygodniowej.');
    }

    const now = new Date();
    if (!isAllowedWeek(parsed.data.weekStart, now, profile.timezone)) {
      return fail('Możesz zapisać refleksję tylko za bieżący lub poprzedni tydzień.');
    }

    const upsertError = await persistWeeklyReflection(supabase, parsed.data, now);
    if (upsertError) {
      return unexpected('saveWeeklyReflection:upsert', upsertError);
    }

    const replanErrorResult = await triggerPlannerReplan(supabase, user.id, now);
    if (replanErrorResult) {
      return replanErrorResult;
    }

    revalidatePath(REFLECTION_PATH);
    revalidatePath(CALENDAR_PATH);
    return ok({ weekStart: parsed.data.weekStart });
  } catch (err) {
    return unexpected('saveWeeklyReflection', err);
  }
}

async function persistMonthlyReflection(
  supabase: ServerSupabase,
  data: MonthlyReflectionInput,
  now: Date,
) {
  const { error } = await supabase.from('monthly_reflections').upsert(
    {
      month: data.month,
      went_well: data.wentWell,
      went_badly: data.wentBadly,
      types_review: data.typesReview,
      goals_next: data.goalsNext,
      priorities_change: data.prioritiesChange,
      updated_at: now.toISOString(),
    },
    { onConflict: 'user_id,month' },
  );

  return error;
}

export async function saveMonthlyReflection(
  input: unknown,
): Promise<ActionResult<{ month: string }>> {
  const parsed = MonthlyReflectionSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  try {
    const context = await getVerifiedContext();
    if ('errorResult' in context) {
      return context.errorResult as ActionResult<{ month: string }>;
    }
    const { supabase, profile } = context;

    if (!canAccessMonthlyReflection(profile.reflection_level)) {
      return fail('Poziom refleksji nie pozwala na wypełnienie podsumowania miesięcznego.');
    }

    const now = new Date();
    if (!isAllowedMonth(parsed.data.month, now, profile.timezone)) {
      return fail('Nieprawidłowy miesiąc.');
    }

    const upsertError = await persistMonthlyReflection(supabase, parsed.data, now);
    if (upsertError) {
      return unexpected('saveMonthlyReflection:upsert', upsertError);
    }

    revalidatePath(REFLECTION_PATH);
    return ok({ month: parsed.data.month });
  } catch (err) {
    return unexpected('saveMonthlyReflection', err);
  }
}
