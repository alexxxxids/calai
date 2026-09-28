import type * as z from 'zod';

/**
 * What every Server Action returns. Expected failures are values, not
 * exceptions: the form shows `error` (Polish, for humans) and `fieldErrors`.
 */
export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T>(error: string, fieldErrors?: Record<string, string[]>): ActionResult<T> {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

export function invalidInput<T>(error: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail('Popraw zaznaczone pola.', fieldErrors);
}

/** Logs the real cause on the server and returns a generic message to the user. */
export function unexpected<T>(context: string, cause: unknown): ActionResult<T> {
  console.error(`[${context}]`, cause);
  return fail('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
}

export const UNAUTHORIZED_MESSAGE = 'Sesja wygasła. Zaloguj się ponownie.';

export function unauthorized<T>(): ActionResult<T> {
  return fail(UNAUTHORIZED_MESSAGE);
}

/**
 * State of a form driven by `useActionState`: null until the first submit,
 * then the result of the last one. A form action receives it as its first argument.
 */
export type FormState<T = null> = ActionResult<T> | null;

/** The first message for one field, shown under that field (or undefined). */
export function fieldError(state: FormState<unknown>, field: string): string | undefined {
  if (state === null || state.ok) {
    return undefined;
  }
  return state.fieldErrors?.[field]?.[0];
}
