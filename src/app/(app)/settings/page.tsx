import 'server-only';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/features/profile/queries';
import { ProfileSettings } from '@/features/profile/components/profile-settings';
import { PlanningSettings } from '@/features/profile/components/planning-settings';
import { AppearanceSettings } from '@/features/profile/components/appearance-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata: Metadata = {
  title: 'Ustawienia — CalAI',
  description: 'Zarządzaj ustawieniami profilu, planowania czasu i wyglądu aplikacji.',
};

const TIME_SLICE_LENGTH = 5;

/**
 * Normalizuje czas z formatu bazy 'HH:MM:SS' do 'HH:mm' dla inputów time.
 */
function normalizeTime(timeStr: string | null | undefined, fallback: string): string {
  if (!timeStr) return fallback;
  return timeStr.slice(0, TIME_SLICE_LENGTH);
}

export default async function SettingsPage() {
  const { user } = await requireUser();
  const supabase = await createClient();

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    redirect('/onboarding');
  }

  const profileData = {
    displayName: profile.display_name ?? '',
    timezone: profile.timezone,
    dayStart: normalizeTime(profile.day_start, '08:00'),
    dayEnd: normalizeTime(profile.day_end, '22:00'),
  };

  const planningData = {
    dailyEnergyLimit: profile.daily_energy_limit,
    reflectionLevel: profile.reflection_level,
  };

  return (
    <div className="container max-w-4xl py-8 px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Ustawienia
        </h1>
        <p className="mt-1 text-muted-foreground">
          Konfiguracja konta, preferencji planisty i wyglądu systemu.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="planning">Planowanie</TabsTrigger>
          <TabsTrigger value="appearance">Wygląd</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="outline-none">
          <ProfileSettings initialData={profileData} />
        </TabsContent>

        <TabsContent value="planning" className="outline-none">
          <PlanningSettings initialData={planningData} />
        </TabsContent>

        <TabsContent value="appearance" className="outline-none">
          <AppearanceSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
