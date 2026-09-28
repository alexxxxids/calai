import type { Metadata } from 'next';
import Link from 'next/link';
import { AUTH_LINK_CLASS, AuthCard } from '@/features/auth/components/auth-card';
import { SignUpForm } from '@/features/auth/components/sign-up-form';
import { requireGuest } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Rejestracja',
};

export default async function RegisterPage() {
  await requireGuest();

  return (
    <AuthCard
      title="Załóż konto"
      description="Po rejestracji wyślemy ci na e-mail kod, którym potwierdzisz adres."
      footer={
        <p>
          Masz już konto?{' '}
          <Link href="/login" className={AUTH_LINK_CLASS}>
            Zaloguj się
          </Link>
        </p>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
