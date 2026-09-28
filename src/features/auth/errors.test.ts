import type { AuthError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { authFailure } from './errors';

function makeAuthError(code?: string, message = 'Supabase internal error'): AuthError {
  const error = new Error(message) as AuthError;
  error.name = 'AuthError';
  (error as unknown as { code?: string }).code = code;
  return error;
}

describe('authFailure', () => {
  const expectedMappings: [string, string][] = [
    ['invalid_credentials', 'Nieprawidłowy e-mail lub hasło.'],
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
  ];

  for (const [code, expectedPolishText] of expectedMappings) {
    it(`should map ${code} to Polish message`, () => {
      const error = makeAuthError(code);
      const result = authFailure('test-context', error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(expectedPolishText);
      }
    });
  }

  it('should return generic unexpected error message for unknown error code', () => {
    const error = makeAuthError('some_unknown_vendor_code');
    const result = authFailure('test-context', error);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
    }
  });

  it('should return generic unexpected error message when error has no code', () => {
    const error = makeAuthError(undefined);
    const result = authFailure('test-context', error);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
    }
  });
});
