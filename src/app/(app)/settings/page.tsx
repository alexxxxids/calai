import 'server-only';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TabsContent } from '@/components/ui/tabs';
import { AccountSettings } from '@/features/account/components/account-settings';
import { CalendarFeedSettings } from '@/features/calendar-sync/components/calendar-feed-settings';
import { CalendarSubscriptionsSettings } from '@/features/calendar-sync/components/calendar-subscriptions-settings';
import { getCalendarFeedToken, listCalendarSubscriptions } from '@/features/calendar-sync/queries';
import { AppearanceSettings } from '@/features/profile/components/appearance-settings';
import { PlanningSettings } from '@/features/profile/components/planning-settings';
import { ProfileSettings } from '@/features/profile/components/profile-settings';
import { getProfile } from '@/features/profile/queries';
import { listTaskTypes } from '@/features/task-types/queries';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { resolveTabFromHash } from './anchors';
import { DynamicPushSettings } from './push-settings-client';
import { SettingsTabs } from './settings-tabs';

export const metadata: Metadata = {
  title: 'Ustawienia — CalAI',
  description: 'Zarządzaj ustawieniami profilu, planowania czasu, powiadomień, kalendarzy i konta.',
};

const TIME_SLICE_LENGTH = 5;

/**
 * Normalizuje czas z formatu bazy 'HH:MM:SS' do 'HH:mm' dla inputów time.
 */
function normalizeTime(timeStr: string | null | undefined, fallback: string): string {
  if (!timeStr) {
    return fallback;
  }
  return timeStr.slice(0, TIME_SLICE_LENGTH);
}

interface SettingsPageProps {
  readonly searchParams?: Promise<{ tab?: string | string[] }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const resolvedSearchParams = await searchParams;
  const rawTab = Array.isArray(resolvedSearchParams?.tab)
    ? resolvedSearchParams.tab[0]
    : resolvedSearchParams?.tab;
  const initialTab = rawTab ? resolveTabFromHash(rawTab) : undefined;

  const { user } = await requireUser();
  const supabase = await createClient();

  const [profile, taskTypes, feedToken, subscriptions] = await Promise.all([
    getProfile(supabase, user.id),
    listTaskTypes(supabase, user.id),
    getCalendarFeedToken(supabase, user.id),
    listCalendarSubscriptions(supabase, user.id),
  ]);

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

  const taskTypeOptions = taskTypes.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }));

  return (
    <div className="container max-w-4xl py-8 px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Ustawienia
        </h1>
        <p className="mt-1 text-muted-foreground">
          Konfiguracja profilu, planisty, powiadomień, kalendarzy i konta.
        </p>
      </div>

      <SettingsTabs initialTab={initialTab}>
        <TabsContent value="profile" id="panel-profile" aria-labelledby="tab-profile" className="outline-none">
          <ProfileSettings initialData={profileData} />
        </TabsContent>

        <TabsContent value="planning" id="panel-planning" aria-labelledby="tab-planning" className="outline-none">
          <PlanningSettings initialData={planningData} />
        </TabsContent>

        <TabsContent value="appearance" id="panel-appearance" aria-labelledby="tab-appearance" className="outline-none">
          <AppearanceSettings />
        </TabsContent>

        <TabsContent value="notifications" id="panel-notifications" aria-labelledby="tab-notifications" className="outline-none">
          <DynamicPushSettings />
        </TabsContent>

        <TabsContent value="calendars" id="panel-calendars" aria-labelledby="tab-calendars" className="outline-none">
          <div className="space-y-6">
            <CalendarFeedSettings initialToken={feedToken} />
            <CalendarSubscriptionsSettings
              taskTypes={taskTypeOptions}
              initialSubscriptions={subscriptions}
            />
          </div>
        </TabsContent>

        <TabsContent value="account" id="panel-account" aria-labelledby="tab-account" className="outline-none">
          <AccountSettings />
        </TabsContent>
      </SettingsTabs>
    </div>
  );
}
