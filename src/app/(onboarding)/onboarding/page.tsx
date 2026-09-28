import 'server-only';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getProfile, type ProfileRow } from '@/features/profile/queries';
import {
  postgresToTime,
  DEFAULT_DAILY_ENERGY_LIMIT,
  type OnboardingInput,
} from '@/features/profile/schemas';
import { OnboardingForm } from './onboarding-form';

export const metadata: Metadata = {
  title: 'Konfiguracja konta | CalAI',
  description: 'Dostosuj CalAI do swojego rytmu dnia i preferencji planowania.',
};

const DEFAULT_ONBOARDING_VALUES: OnboardingInput = {
  displayName: '',
  timezone: 'Europe/Warsaw',
  dayStart: '08:00',
  dayEnd: '22:00',
  reflectionLevel: 'basic',
  dailyEnergyLimit: DEFAULT_DAILY_ENERGY_LIMIT,
};

function getInitialValues(
  profile: ProfileRow | null,
  email: string | null
): OnboardingInput {
  if (!profile) {
    const emailPrefix = email ? email.split('@')[0] : '';
    return {
      ...DEFAULT_ONBOARDING_VALUES,
      displayName: emailPrefix ?? '',
    };
  }
  return {
    displayName: profile.display_name ?? '',
    timezone: profile.timezone,
    dayStart: postgresToTime(profile.day_start),
    dayEnd: postgresToTime(profile.day_end),
    reflectionLevel: profile.reflection_level,
    dailyEnergyLimit: profile.daily_energy_limit,
  };
}

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const profile = await getProfile(supabase, user.id);

  if (profile?.onboarded_at) {
    redirect('/calendar');
  }

  const initialValues = getInitialValues(profile, user.email);

  return (
    <main className="w-full max-w-2xl py-6">
      <OnboardingForm initialValues={initialValues} />
    </main>
  );
}
