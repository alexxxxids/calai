import type { AuthError } from '@supabase/supabase-js';
import { fail, unexpected, type ActionResult } from '@/lib/action-result';

/**
 * Supabase Auth errors that are ordinary situations on our screens, with the Polish text
 * for each. We compare `error.code`, never `error.message`: messages are English, meant for
 * developers, and may change between versions. The codes are listed in
 * node_modules/@supabase/auth-js/dist/module/lib/error-codes.d.ts.
 */
const EXPECTED_AUTH_ERRORS = new Map<string, string>([
  ['invalid_credentials', 'Nieprawidłowy e-mail lub hasło.'],
  // Supabase answers a wrong code and an expired code in the same way.
  ['otp_expired', 'Kod jest nieprawidłowy albo wygasł. Sprawdź go albo wyślij nowy.'],
  [
    'over_email_send_rate_limit',
    'Wiadomość wysłaliśmy przed chwilą. Odczekaj 60 sekund i spróbuj ponownie.',
  ],
  ['over_request_rate_limit', 'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.'],
  ['weak_password', 'To hasło jest za słabe. Wybierz dłuższe albo mniej oczywiste.'],
  ['same_password', 'Nowe hasło musi się różnić od obecnego.'],
  ['email_address_invalid', 'Na ten adres nie możemy wysłać wiadomości. Użyj innego.'],
  ['email_address_not_authorized', 'Na ten adres nie możemy jeszcze wysyłać wiadomości.'],
  ['signup_disabled', 'Rejestracja jest teraz wyłączona.'],
]);

/** An expected error → its Polish text; anything else is logged, and the user gets a generic one. */
export function authFailure<T>(context: string, error: AuthError): ActionResult<T> {
  const message = error.code === undefined ? undefined : EXPECTED_AUTH_ERRORS.get(error.code);
  return message === undefined ? unexpected(context, error) : fail(message);
}
