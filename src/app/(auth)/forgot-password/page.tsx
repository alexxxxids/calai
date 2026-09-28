import type { Metadata } from 'next';
import Link from 'next/link';
import { AUTH_LINK_CLASS, AuthCard } from '@/features/auth/components/auth-card';
import { ForgotPasswordForm } from '@/features/auth/components/password-reset-forms';

export const metadata: Metadata = {
  title: 'Nie pamiętasz hasła?',
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Nie pamiętasz hasła?"
      description="Wyślemy ci na e-mail kod, którym ustawisz nowe hasło."
      footer={
        <Link href="/login" className={AUTH_LINK_CLASS}>
          Wróć do logowania
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
