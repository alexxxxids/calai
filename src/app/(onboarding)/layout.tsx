import 'server-only';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getProfile } from '@/features/profile/queries';

export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { supabase, user } = await requireUser();
  const profile = await getProfile(supabase, user.id);

  if (profile?.onboarded_at) {
    redirect('/calendar');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4 md:p-8">
      {children}
    </div>
  );
}
