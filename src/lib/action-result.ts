export type ActionResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string; readonly fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T>(error: string, fieldErrors?: Record<string, string[]>): ActionResult<T> {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}
