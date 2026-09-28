import type { Metadata } from 'next';
import Link from 'next/link';
import { AUTH_LINK_CLASS, AuthCard } from '@/features/auth/components/auth-card';
import { SignInForm } from '@/features/auth/components/sign-in-form';
import { requireGuest } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Logowanie',
};

export default async function LoginPage() {
  await requireGuest();

  return (
    <AuthCard
      title="Zaloguj się"
      description="Wróć do swojego planu."
      footer={
        <>
          <Link href="/forgot-password" className={AUTH_LINK_CLASS}>
            Nie pamiętasz hasła?
          </Link>
          <p>
            Nie masz konta?{' '}
            <Link href="/register" className={AUTH_LINK_CLASS}>
              Załóż je
            </Link>
          </p>
        </>
      }
    >
      <SignInForm />
    </AuthCard>
  );
}
