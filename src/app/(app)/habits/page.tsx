import 'server-only';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { listHabits, getUserTodayDate } from '@/features/habits/queries';
import { HabitsClient } from '@/features/habits/habits-client';

export const metadata: Metadata = {
  title: 'Nawyki — CalAI',
  description: 'Buduj trwałe rytuały i śledź serie wykonania nawyków każdego dnia.',
};

export default async function HabitsPage() {
  const { user } = await requireUser();
  const supabase = await createClient();

  const [habits, profileRes] = await Promise.all([
    listHabits(supabase),
    supabase.from('profiles').select('timezone').eq('id', user.id).single(),
  ]);

  const timezone = profileRes.data?.timezone ?? 'Europe/Warsaw';
  const today = getUserTodayDate(timezone);

  return (
    <div className="container max-w-4xl py-8 px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Nawyki
        </h1>
        <p className="mt-1 text-muted-foreground">
          Śledź swoje codzienne przyzwyczajenia i buduj nieprzerwane serie sukcesów.
        </p>
      </div>

      <HabitsClient habits={habits} today={today} />
    </div>
  );
}
