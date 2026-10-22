import 'server-only';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getProfile } from '@/features/profile/queries';
import { getReflectionState } from '@/features/reflection/queries';
import { ReflectionView } from '@/features/reflection/components/reflection-view';

export const metadata: Metadata = {
  title: 'Refleksja',
  description: 'Tygodniowa samoocena samopoczucia i miesięczny przegląd strategiczny.',
};

export default async function ReflectionPage() {
  const { supabase, user } = await requireUser();

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    redirect('/onboarding');
  }

  const state = await getReflectionState(supabase, user.id, undefined, profile);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Refleksja
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tygodniowa samoocena samopoczucia i miesięczny przegląd strategiczny.
        </p>
      </div>

      <ReflectionView state={state} />
    </div>
  );
}
