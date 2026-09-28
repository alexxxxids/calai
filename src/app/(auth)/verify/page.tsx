import type { Metadata } from 'next';
import Form from 'next/form';
import { TextField } from '@/components/app/text-field';
import { Button } from '@/components/ui/button';
import { AuthCard } from '@/features/auth/components/auth-card';
import { ResendCodeForm, VerifyCodeForm } from '@/features/auth/components/verify-code-form';
import { EmailSearchParamSchema } from '@/features/auth/schemas';

export const metadata: Metadata = {
  title: 'Potwierdź e-mail',
};

export default async function VerifyPage({ searchParams }: PageProps<'/verify'>) {
  const { email: emailParam } = await searchParams;
  const email = EmailSearchParamSchema.parse(emailParam);

  if (email === '') {
    return (
      <AuthCard title="Potwierdź e-mail" description="Podaj adres, na który wysłaliśmy kod.">
        {/* A GET form: it only puts ?email= into the address and shows this page again. */}
        <Form action="/verify" className="flex flex-col gap-5">
          <TextField name="email" label="E-mail" type="email" autoComplete="email" required />
          <Button type="submit">Dalej</Button>
        </Form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Potwierdź e-mail"
      description={
        <>
          Kod wysłaliśmy na adres <strong className="text-foreground">{email}</strong>. Nie ma go?
          Sprawdź folder ze spamem.
        </>
      }
      footer={<ResendCodeForm email={email} />}
    >
      <VerifyCodeForm email={email} />
    </AuthCard>
  );
}
