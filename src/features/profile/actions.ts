'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import type { Database } from '@/types/database.types';
import {
  ok,
  fail,
  invalidInput,
  unauthorized,
  unexpected,
  type ActionResult,
} from '@/lib/action-result';
import {
  OnboardingSchema,
  ProfileUpdateSchema,
  TimezoneUpdateSchema,
  timeToPostgres,
  type ProfileUpdateInput,
} from './schemas';
import { ensureStarterTypes } from '@/features/task-types/starter-types';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

function buildProfileUpdate(input: ProfileUpdateInput): ProfileUpdate {
  const updateData: ProfileUpdate = {};
  if (input.displayName !== undefined) {
    updateData.display_name = input.displayName;
  }
  if (input.timezone !== undefined) {
    updateData.timezone = input.timezone;
  }
  if (input.dayStart !== undefined) {
    updateData.day_start = timeToPostgres(input.dayStart);
  }
  if (input.dayEnd !== undefined) {
    updateData.day_end = timeToPostgres(input.dayEnd);
  }
  if (input.reflectionLevel !== undefined) {
    updateData.reflection_level = input.reflectionLevel;
  }
  if (input.dailyEnergyLimit !== undefined) {
    updateData.daily_energy_limit = input.dailyEnergyLimit;
  }
  return updateData;
}

/**
 * Completes the onboarding process: saves user settings, creates starter task types,
 * stamps onboarded_at, and invalidates layout cache.
 */
export async function completeOnboarding(
  input: unknown
): Promise<ActionResult<{ success: true }>> {
  const parsed = OnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    // 1. Ensure starter types (FR-12)
    await ensureStarterTypes(supabase, user.id);

    // 2. Update profile with settings and stamp onboarded_at
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: parsed.data.displayName,
        timezone: parsed.data.timezone,
        day_start: timeToPostgres(parsed.data.dayStart),
        day_end: timeToPostgres(parsed.data.dayEnd),
        reflection_level: parsed.data.reflectionLevel,
        daily_energy_limit: parsed.data.dailyEnergyLimit,
        onboarded_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      return fail(`Nie udało się zapisać profilu: ${updateError.message}`);
    }

    revalidatePath('/', 'layout');
    return ok({ success: true });
  } catch (err) {
    return unexpected('Błąd podczas zapisywania konfiguracji', err);
  }
}

/**
 * Updates profile settings (display name, timezone, working window, reflection level, daily limit).
 */
export async function updateProfile(
  input: unknown
): Promise<ActionResult<{ success: true }>> {
  const parsed = ProfileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  try {
    const updateData = buildProfileUpdate(parsed.data);

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (error) {
      return fail(`Nie udało się zaktualizować profilu: ${error.message}`);
    }

    revalidatePath('/settings');
    revalidatePath('/', 'layout');
    return ok({ success: true });
  } catch (err) {
    return unexpected('Błąd podczas aktualizacji profilu', err);
  }
}

/**
 * Quick action to update user timezone (e.g. from TimezoneBanner).
 */
export async function updateTimezone(
  input: unknown
): Promise<ActionResult<{ timezone: string }>> {
  const parsed = TimezoneUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthorized();
  }

  const { error } = await supabase
    .from('profiles')
    .update({ timezone: parsed.data.timezone })
    .eq('id', user.id);

  if (error) {
    return fail(`Nie udało się zaktualizować strefy czasowej: ${error.message}`);
  }

  revalidatePath('/', 'layout');
  return ok({ timezone: parsed.data.timezone });
}
