import { describe, expect, it } from 'vitest';
import {
  EmailOnlySchema,
  EmailSearchParamSchema,
  ResetPasswordSchema,
  SignInSchema,
  SignUpSchema,
  VerifyCodeSchema,
} from './schemas';

describe('SignUpSchema', () => {
  it('should accept valid registration input with matching password and adult consent', () => {
    const result = SignUpSchema.safeParse({
      email: 'jan@example.pl',
      password: 'password123',
      confirmPassword: 'password123',
      adult: 'on',
    });
    expect(result.success).toBe(true);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = SignUpSchema.safeParse({
      email: 'jan@example.pl',
      password: 'short',
      confirmPassword: 'short',
      adult: 'on',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('password'))).toBe(true);
    }
  });

  it('should reject when confirmPassword does not match password', () => {
    const result = SignUpSchema.safeParse({
      email: 'jan@example.pl',
      password: 'password123',
      confirmPassword: 'differentPassword',
      adult: 'on',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('confirmPassword'))).toBe(true);
    }
  });

  it('should reject password exceeding 72 bytes due to multibyte characters', () => {
    // 37 Polish letters 'ą' = 74 bytes in UTF-8
    const longPassword = 'ą'.repeat(37);
    const result = SignUpSchema.safeParse({
      email: 'jan@example.pl',
      password: longPassword,
      confirmPassword: longPassword,
      adult: 'on',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('maksymalnie 72'))).toBe(true);
    }
  });

  it('should reject when adult checkbox is not on', () => {
    const result = SignUpSchema.safeParse({
      email: 'jan@example.pl',
      password: 'password123',
      confirmPassword: 'password123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('adult'))).toBe(true);
    }
  });

  it('should reject invalid email address', () => {
    const result = SignUpSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
      confirmPassword: 'password123',
      adult: 'on',
    });
    expect(result.success).toBe(false);
  });

  it('should trim surrounding whitespace from email', () => {
    const result = SignUpSchema.safeParse({
      email: '  jan@example.pl  ',
      password: 'password123',
      confirmPassword: 'password123',
      adult: 'on',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('jan@example.pl');
    }
  });
});

describe('VerifyCodeSchema', () => {
  it('should accept 6-digit code', () => {
    const result = VerifyCodeSchema.safeParse({
      email: 'jan@example.pl',
      code: '123456',
    });
    expect(result.success).toBe(true);
  });

  it('should accept 10-digit code', () => {
    const result = VerifyCodeSchema.safeParse({
      email: 'jan@example.pl',
      code: '1234567890',
    });
    expect(result.success).toBe(true);
  });

  it('should reject 5-digit code', () => {
    const result = VerifyCodeSchema.safeParse({
      email: 'jan@example.pl',
      code: '12345',
    });
    expect(result.success).toBe(false);
  });

  it('should reject 11-digit code', () => {
    const result = VerifyCodeSchema.safeParse({
      email: 'jan@example.pl',
      code: '12345678901',
    });
    expect(result.success).toBe(false);
  });

  it('should reject code containing non-digits', () => {
    const result = VerifyCodeSchema.safeParse({
      email: 'jan@example.pl',
      code: '12345a',
    });
    expect(result.success).toBe(false);
  });
});

describe('SignInSchema', () => {
  it('should accept valid email and non-empty password', () => {
    const result = SignInSchema.safeParse({
      email: 'jan@example.pl',
      password: 'anyPassword',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty password', () => {
    const result = SignInSchema.safeParse({
      email: 'jan@example.pl',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('ResetPasswordSchema', () => {
  it('should accept valid reset form input', () => {
    const result = ResetPasswordSchema.safeParse({
      email: 'jan@example.pl',
      code: '654321',
      password: 'newPassword123',
      confirmPassword: 'newPassword123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject mismatching new passwords', () => {
    const result = ResetPasswordSchema.safeParse({
      email: 'jan@example.pl',
      code: '654321',
      password: 'newPassword123',
      confirmPassword: 'differentPassword',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('confirmPassword'))).toBe(true);
    }
  });
});

describe('EmailOnlySchema and EmailSearchParamSchema', () => {
  it('should validate single email field', () => {
    expect(EmailOnlySchema.safeParse({ email: 'jan@example.pl' }).success).toBe(true);
    expect(EmailOnlySchema.safeParse({ email: 'invalid' }).success).toBe(false);
  });

  it('should fallback to empty string for invalid email search param', () => {
    expect(EmailSearchParamSchema.parse('jan@example.pl')).toBe('jan@example.pl');
    expect(EmailSearchParamSchema.parse('not-an-email')).toBe('');
    expect(EmailSearchParamSchema.parse(undefined)).toBe('');
  });
});
