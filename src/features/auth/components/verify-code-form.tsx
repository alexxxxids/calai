'use client';

import { useActionState } from 'react';
import { ActionForm } from '@/components/app/action-form';
import { FormAlert } from '@/components/app/form-alert';
import { SubmitButton } from '@/components/app/submit-button';
import { TextField } from '@/components/app/text-field';
import { fieldError } from '@/lib/action-result';
import { resendSignUpCode, verifySignUpCode } from '../actions';

/**
 * The code field. A plain input, not one box per digit: the code has 6–10 digits depending on
 * the Supabase settings, and `one-time-code` lets the phone offer the code from the e-mail.
 */
export function VerifyCodeForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(verifySignUpCode, null);

  return (
    <ActionForm action={formAction} className="flex flex-col gap-5">
      <FormAlert state={state} />
      <input type="hidden" name="email" value={email} />
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
      <SubmitButton pending={pending}>Potwierdź</SubmitButton>
    </ActionForm>
  );
}

/** A separate small form: sending a new code needs only the address, not the code field. */
export function ResendCodeForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(resendSignUpCode, null);

  return (
    <ActionForm action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="email" value={email} />
      <SubmitButton pending={pending} variant="link" className="h-auto px-0">
        Wyślij kod ponownie
      </SubmitButton>
      {/* Always in the page, so screen readers announce the text when it appears. */}
      <p role="status" className="text-sm text-muted-foreground">
        {state?.ok ? 'Wysłaliśmy nowy kod. Sprawdź też folder ze spamem.' : null}
      </p>
      <FormAlert state={state} />
    </ActionForm>
  );
}
