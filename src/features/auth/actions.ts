'use server';

import { redirect } from 'next/navigation';
import {
  fail,
  invalidInput,
  ok,
  unexpected,
  type ActionResult,
  type FormState,
} from '@/lib/action-result';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';
import { authFailure } from './errors';
import {
  EmailOnlySchema,
  ResetPasswordSchema,
  SignInSchema,
  SignUpSchema,
  VerifyCodeSchema,
} from './schemas';

// Registration and login (docs/architecture.md §6.1, spec FR-01…FR-05). The forms call these
// through useActionState: the first argument is the state of the previous submit, unused here.
// redirect() works by throwing, so it is never called inside a try block that could swallow it.

export async function signUp(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = SignUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    adult: formData.get('adult'),
  });
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }
  const { email, password } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // spec FR-01: the moment of the 18+ confirmation, kept in the user's metadata.
    options: { data: { adult_confirmed_at: new Date().toISOString() } },
  });
  if (error) {
    return authFailure('auth/signUp', error);
  }
  // With "Confirm email" on, Supabase answers the same way whether the address is new or taken,
  // so the next page reveals nothing about other people's accounts.
  if (data.session) {
    return refuseUnconfirmedSession(supabase);
  }
  redirect(`/verify?email=${encodeURIComponent(email)}`);
}

/**
 * A session right after sign-up means "Confirm email" is switched off in the Supabase project,
 * and anyone could register someone else's address. We drop the session instead of logging in.
 */
async function refuseUnconfirmedSession(supabase: ServerSupabase): Promise<FormState> {
  console.error('[auth/signUp] Supabase returned a session: turn on Auth → Email → Confirm email.');
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    console.error('[auth/signUp] could not drop the unconfirmed session', error);
  }
  return fail(
    'Rejestracja jest źle skonfigurowana: w projekcie Supabase wyłączono potwierdzanie adresu e-mail (Confirm email). Włącz je i spróbuj ponownie.',
  );
}

export async function verifySignUpCode(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = VerifyCodeSchema.safeParse({
    email: formData.get('email'),
    code: formData.get('code'),
  });
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: 'email',
  });
  if (error) {
    return authFailure('auth/verifySignUpCode', error);
  }
  redirect('/onboarding');
}

export async function resendSignUpCode(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = EmailOnlySchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: 'signup', email: parsed.data.email });
  if (error) {
    return authFailure('auth/resendSignUpCode', error);
  }
  return ok(null);
}

/** The usual form state, plus one failure that the form shows with a link to the code page. */
export type SignInState = FormState | { ok: false; error: string; unconfirmedEmail: string };

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = SignInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }
  const { email, password } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Supabase checks the password first, so this answer never reveals someone else's account.
  if (error?.code === 'email_not_confirmed') {
    return {
      ok: false,
      error: 'Najpierw potwierdź adres e-mail kodem z wiadomości.',
      unconfirmedEmail: email,
    };
  }
  if (error) {
    return authFailure('auth/signIn', error);
  }
  // The app layout sends a user who has not finished onboarding on to /onboarding.
  redirect('/calendar');
}

/** Returns only when something went wrong: on success it redirects to /login. */
export async function signOut(): Promise<ActionResult<never>> {
  const supabase = await createClient();
  // 'local' ends the session on this device only; the phone stays signed in.
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    return unexpected('auth/signOut', error);
  }
  redirect('/login');
}

export async function requestPasswordReset(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = EmailOnlySchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const supabase = await createClient();
  // Supabase answers "sent" also for an address without an account, so nothing is revealed.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);
  if (error) {
    return authFailure('auth/requestPasswordReset', error);
  }
  redirect(`/reset-password?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function resetPassword(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = ResetPasswordSchema.safeParse({
    email: formData.get('email'),
    code: formData.get('code'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    return invalidInput(parsed.error);
  }
  const { email, code, password } = parsed.data;

  const supabase = await createClient();
  // A correct recovery code signs the user in; only then may the password be changed.
  const verified = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
  if (verified.error) {
    return authFailure('auth/resetPassword', verified.error);
  }
  const updated = await supabase.auth.updateUser({ password });
  if (updated.error) {
    return authFailure('auth/resetPassword', updated.error);
  }
  redirect('/calendar');
}
