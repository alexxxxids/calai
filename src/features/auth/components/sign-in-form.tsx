'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ActionForm } from '@/components/app/action-form';
import { FormAlert } from '@/components/app/form-alert';
import { SubmitButton } from '@/components/app/submit-button';
import { TextField } from '@/components/app/text-field';
import { FieldGroup } from '@/components/ui/field';
import { fieldError } from '@/lib/action-result';
import { signIn } from '../actions';
import { AUTH_LINK_CLASS } from './auth-card';

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, null);
  // Set only when the password was right but the address was never confirmed.
  const unconfirmedEmail = state !== null && 'unconfirmedEmail' in state ? state.unconfirmedEmail : null;

  return (
    <ActionForm action={formAction} className="flex flex-col gap-5">
      <FormAlert state={state} />
      {unconfirmedEmail && (
        <p className="text-sm">
          <Link
            href={`/verify?email=${encodeURIComponent(unconfirmedEmail)}`}
            className={AUTH_LINK_CLASS}
          >
            Wpisz kod z wiadomości
          </Link>{' '}
          albo wyślij nowy.
        </p>
      )}
      <FieldGroup>
        <TextField
          name="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          error={fieldError(state, 'email')}
        />
        <TextField
          name="password"
          label="Hasło"
          type="password"
          autoComplete="current-password"
          required
          error={fieldError(state, 'password')}
        />
      </FieldGroup>
      <SubmitButton pending={pending}>Zaloguj się</SubmitButton>
    </ActionForm>
  );
}
