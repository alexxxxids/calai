'use client';

import { useActionState } from 'react';
import { ActionForm } from '@/components/app/action-form';
import { FormAlert } from '@/components/app/form-alert';
import { SubmitButton } from '@/components/app/submit-button';
import { TextField } from '@/components/app/text-field';
import { FieldGroup } from '@/components/ui/field';
import { fieldError } from '@/lib/action-result';
import { requestPasswordReset, resetPassword } from '../actions';
import { PASSWORD_MIN_LENGTH } from '../schemas';

/** Step 1 of spec FR-04: the address that gets the code. */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null);

  return (
    <ActionForm action={formAction} className="flex flex-col gap-5">
      <FormAlert state={state} />
      <TextField
        name="email"
        label="E-mail"
        type="email"
        autoComplete="email"
        required
        error={fieldError(state, 'email')}
      />
      <SubmitButton pending={pending}>Wyślij kod</SubmitButton>
    </ActionForm>
  );
}

/** Step 2 of spec FR-04: the code from the e-mail and the new password. */
export function ResetPasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, null);

  return (
    <ActionForm action={formAction} className="flex flex-col gap-5">
      <FormAlert state={state} />
      <FieldGroup>
        <TextField
          name="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          defaultValue={email}
          required
          error={fieldError(state, 'email')}
        />
        <TextField
          name="code"
          label="Kod z wiadomości"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,10}"
          title="Od 6 do 10 cyfr"
          maxLength={10}
          required
          error={fieldError(state, 'code')}
        />
        <TextField
          name="password"
          label="Nowe hasło"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          description={`Co najmniej ${PASSWORD_MIN_LENGTH} znaków.`}
          error={fieldError(state, 'password')}
        />
        <TextField
          name="confirmPassword"
          label="Powtórz nowe hasło"
          type="password"
          autoComplete="new-password"
          required
          error={fieldError(state, 'confirmPassword')}
        />
      </FieldGroup>
      <SubmitButton pending={pending}>Zmień hasło</SubmitButton>
    </ActionForm>
  );
}
