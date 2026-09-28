import 'server-only';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getProfile } from '@/features/profile/queries';
import { AppShell } from '@/components/app/app-shell';

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { supabase, user } = await requireUser();
  const profile = await getProfile(supabase, user.id);

  if (!profile?.onboarded_at) {
    redirect('/onboarding');
  }

  return (
    <AppShell userEmail={user.email} profileTimezone={profile.timezone}>
      {children}
    </AppShell>
  );
}
