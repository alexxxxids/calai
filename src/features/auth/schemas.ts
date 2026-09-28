import * as z from 'zod';

/** spec FR-01. */
export const PASSWORD_MIN_LENGTH = 8;
/** Supabase stores passwords with bcrypt, which reads at most 72 bytes; longer ones are refused. */
const PASSWORD_MAX_BYTES = 72;

const EMAIL_ERROR = 'Podaj poprawny adres e-mail.';
const PASSWORD_ERROR = `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.`;
const CONFIRM_ERROR = 'Hasła nie są takie same.';

// trim() before the format check: an address pasted with a space is still an address.
const EmailSchema = z.string({ error: EMAIL_ERROR }).trim().pipe(z.email({ error: EMAIL_ERROR }));

const NewPasswordSchema = z
  .string({ error: PASSWORD_ERROR })
  .min(PASSWORD_MIN_LENGTH, PASSWORD_ERROR)
  .refine(
    // Polish letters take 2 bytes each, so the limit is counted in bytes, not characters.
    (password) => new TextEncoder().encode(password).length <= PASSWORD_MAX_BYTES,
    `Hasło jest za długie: maksymalnie ${PASSWORD_MAX_BYTES} bajty (polska litera zajmuje dwa).`,
  );

/**
 * The code from the e-mail. Its length (6–10 digits) is a setting of the Supabase
 * project, so the form accepts the whole range instead of assuming 6.
 */
export const OtpCodeSchema = z
  .string({ error: 'Wpisz kod z wiadomości.' })
  .trim()
  .regex(/^\d{6,10}$/, 'Kod to od 6 do 10 cyfr z wiadomości.');

export const SignUpSchema = z
  .object({
    email: EmailSchema,
    password: NewPasswordSchema,
    confirmPassword: z.string({ error: CONFIRM_ERROR }),
    // A checked checkbox sends 'on'; an unchecked one sends nothing (spec FR-01, ADR-008).
    adult: z.literal('on', { error: 'Aplikacja jest tylko dla osób pełnoletnich.' }),
  })
  .refine((form) => form.password === form.confirmPassword, {
    path: ['confirmPassword'],
    error: CONFIRM_ERROR,
  });

export const SignInSchema = z.object({
  email: EmailSchema,
  // Only "is it there": the rules for a new password must not lock out an old account.
  password: z.string({ error: 'Wpisz hasło.' }).min(1, 'Wpisz hasło.'),
});

export const VerifyCodeSchema = z.object({
  email: EmailSchema,
  code: OtpCodeSchema,
});

export const EmailOnlySchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordSchema = z
  .object({
    email: EmailSchema,
    code: OtpCodeSchema,
    password: NewPasswordSchema,
    confirmPassword: z.string({ error: CONFIRM_ERROR }),
  })
  .refine((form) => form.password === form.confirmPassword, {
    path: ['confirmPassword'],
    error: CONFIRM_ERROR,
  });

/** `?email=` in the URL: only a valid address is used to fill the form, anything else is ignored. */
export const EmailSearchParamSchema = EmailSchema.catch('');
