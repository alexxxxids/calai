import type { Metadata } from 'next';
import Link from 'next/link';
import { AUTH_LINK_CLASS, AuthCard } from '@/features/auth/components/auth-card';
import { ResetPasswordForm } from '@/features/auth/components/password-reset-forms';
import { EmailSearchParamSchema } from '@/features/auth/schemas';

export const metadata: Metadata = {
  title: 'Nowe hasło',
};

export default async function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  const { email: emailParam } = await searchParams;
  const email = EmailSearchParamSchema.parse(emailParam);

  return (
    <AuthCard
      title="Ustaw nowe hasło"
      // The same words whether the account exists or not: this page must not reveal it.
      description="Jeśli konto z tym adresem istnieje, wysłaliśmy na nie kod. Wpisz go i wybierz nowe hasło."
      footer={
        <p>
          Kod nie dotarł?{' '}
          <Link href="/forgot-password" className={AUTH_LINK_CLASS}>
            Wyślij go ponownie
          </Link>
        </p>
      }
    >
      <ResetPasswordForm email={email} />
    </AuthCard>
  );
}
