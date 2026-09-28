'use client';

import Link from 'next/link';
import { useActionState, useId } from 'react';
import { ActionForm } from '@/components/app/action-form';
import { FormAlert } from '@/components/app/form-alert';
import { SubmitButton } from '@/components/app/submit-button';
import { TextField } from '@/components/app/text-field';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { fieldError } from '@/lib/action-result';
import { signUp } from '../actions';
import { PASSWORD_MIN_LENGTH } from '../schemas';
import { AUTH_LINK_CLASS } from './auth-card';

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, null);

  return (
    <ActionForm action={formAction} className="flex flex-col gap-5">
      <FormAlert state={state} />
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
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          description={`Co najmniej ${PASSWORD_MIN_LENGTH} znaków.`}
          error={fieldError(state, 'password')}
        />
        <TextField
          name="confirmPassword"
          label="Powtórz hasło"
          type="password"
          autoComplete="new-password"
          required
          error={fieldError(state, 'confirmPassword')}
        />
        <AdultCheckbox error={fieldError(state, 'adult')} />
      </FieldGroup>
      <p className="text-sm text-muted-foreground">
        Zakładając konto, akceptujesz{' '}
        <Link href="/privacy" className={AUTH_LINK_CLASS}>
          politykę prywatności
        </Link>
        .
      </p>
      <SubmitButton pending={pending}>Załóż konto</SubmitButton>
    </ActionForm>
  );
}

/** spec FR-01: without this box the form is not sent (the browser checks `required`). */
function AdultCheckbox({ error }: { error?: string }) {
  const id = useId();
  const descriptionId = `${id}-description`;

  return (
    <Field orientation="horizontal" data-invalid={error ? true : undefined}>
      <Checkbox
        id={id}
        name="adult"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={descriptionId}
      />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={id}>Mam ukończone 18 lat</FieldLabel>
        <FieldDescription id={descriptionId}>
          Tego wymagają warunki usługi AI, z której korzysta CalAI.
        </FieldDescription>
        {error && <FieldError>{error}</FieldError>}
      </div>
    </Field>
  );
}
