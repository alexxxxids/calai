import { describe, expect, it } from 'vitest';
import {
  DELETE_ACCOUNT_ERROR,
  DELETE_ACCOUNT_KEYWORD,
  DeleteAccountSchema,
} from './schemas';

describe('DeleteAccountSchema', () => {
  it('accepts valid confirmation input with exact keyword', () => {
    const result = DeleteAccountSchema.safeParse({
      confirmation: DELETE_ACCOUNT_KEYWORD,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmation).toBe('USUŃ');
    }
  });

  it('rejects lowercase "usun"', () => {
    const result = DeleteAccountSchema.safeParse({ confirmation: 'usun' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(DELETE_ACCOUNT_ERROR);
    }
  });

  it('rejects "USUN" without diacritics', () => {
    const result = DeleteAccountSchema.safeParse({ confirmation: 'USUN' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(DELETE_ACCOUNT_ERROR);
    }
  });

  it('rejects "USUŃ " with trailing space', () => {
    const result = DeleteAccountSchema.safeParse({ confirmation: 'USUŃ ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(DELETE_ACCOUNT_ERROR);
    }
  });

  it('rejects " USUŃ" with leading space', () => {
    const result = DeleteAccountSchema.safeParse({ confirmation: ' USUŃ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(DELETE_ACCOUNT_ERROR);
    }
  });

  it('rejects English word "DELETE"', () => {
    const result = DeleteAccountSchema.safeParse({ confirmation: 'DELETE' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(DELETE_ACCOUNT_ERROR);
    }
  });

  it('rejects empty string', () => {
    const result = DeleteAccountSchema.safeParse({ confirmation: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(DELETE_ACCOUNT_ERROR);
    }
  });

  it('rejects null confirmation', () => {
    const result = DeleteAccountSchema.safeParse({ confirmation: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(DELETE_ACCOUNT_ERROR);
    }
  });

  it('rejects undefined confirmation', () => {
    const result = DeleteAccountSchema.safeParse({ confirmation: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(DELETE_ACCOUNT_ERROR);
    }
  });

  it('rejects empty object {}', () => {
    const result = DeleteAccountSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(DELETE_ACCOUNT_ERROR);
    }
  });

  it('rejects null input root', () => {
    const result = DeleteAccountSchema.safeParse(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(DELETE_ACCOUNT_ERROR);
    }
  });

  it('rejects undefined input root', () => {
    const result = DeleteAccountSchema.safeParse(undefined);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(DELETE_ACCOUNT_ERROR);
    }
  });

  it('rejects numeric or boolean confirmation type', () => {
    const numResult = DeleteAccountSchema.safeParse({ confirmation: 123 });
    expect(numResult.success).toBe(false);
    if (!numResult.success) {
      expect(numResult.error.issues[0]?.message).toBe(DELETE_ACCOUNT_ERROR);
    }

    const boolResult = DeleteAccountSchema.safeParse({ confirmation: true });
    expect(boolResult.success).toBe(false);
    if (!boolResult.success) {
      expect(boolResult.error.issues[0]?.message).toBe(DELETE_ACCOUNT_ERROR);
    }
  });
});
