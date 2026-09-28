import { describe, it, expect } from 'vitest';
import {
  OnboardingSchema,
  ProfileUpdateSchema,
  postgresToTime,
  timeToPostgres,
  isValidIanaTimezone,
} from './schemas';

describe('profile schemas & time helpers', () => {
  describe('postgresToTime', () => {
    it('converts HH:MM:SS to HH:MM', () => {
      expect(postgresToTime('08:00:00')).toBe('08:00');
      expect(postgresToTime('22:30:15')).toBe('22:30');
    });

    it('handles HH:MM without seconds', () => {
      expect(postgresToTime('08:00')).toBe('08:00');
    });

    it('throws error for invalid format', () => {
      expect(() => postgresToTime('25:00:00')).toThrow();
      expect(() => postgresToTime('invalid')).toThrow();
    });
  });

  describe('timeToPostgres', () => {
    it('converts HH:MM to HH:MM:00', () => {
      expect(timeToPostgres('08:00')).toBe('08:00:00');
      expect(timeToPostgres('22:30')).toBe('22:30:00');
    });

    it('keeps HH:MM:SS if already present', () => {
      expect(timeToPostgres('08:00:00')).toBe('08:00:00');
    });

    it('throws error for invalid format', () => {
      expect(() => timeToPostgres('8:00')).toThrow();
      expect(() => timeToPostgres('abc')).toThrow();
    });
  });

  describe('isValidIanaTimezone', () => {
    it('accepts valid IANA timezones', () => {
      expect(isValidIanaTimezone('Europe/Warsaw')).toBe(true);
      expect(isValidIanaTimezone('America/New_York')).toBe(true);
      expect(isValidIanaTimezone('UTC')).toBe(true);
    });

    it('rejects Factory and unknown zones', () => {
      expect(isValidIanaTimezone('Factory')).toBe(false);
      expect(isValidIanaTimezone('Mars/Olympus')).toBe(false);
      expect(isValidIanaTimezone('')).toBe(false);
    });
  });

  describe('OnboardingSchema', () => {
    const validData = {
      displayName: 'Jan Kowalski',
      timezone: 'Europe/Warsaw',
      dayStart: '08:00',
      dayEnd: '22:00',
      reflectionLevel: 'basic' as const,
      dailyEnergyLimit: 20,
    };

    it('validates correct onboarding payload', () => {
      const result = OnboardingSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects when dayEnd <= dayStart', () => {
      const result = OnboardingSchema.safeParse({
        ...validData,
        dayStart: '10:00',
        dayEnd: '09:00',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('Koniec okna dnia musi być późniejszy niż początek');
      }

      const equalResult = OnboardingSchema.safeParse({
        ...validData,
        dayStart: '10:00',
        dayEnd: '10:00',
      });
      expect(equalResult.success).toBe(false);
    });

    it('rejects daily energy limit below 4 or above 60', () => {
      expect(OnboardingSchema.safeParse({ ...validData, dailyEnergyLimit: 3 }).success).toBe(false);
      expect(OnboardingSchema.safeParse({ ...validData, dailyEnergyLimit: 61 }).success).toBe(false);
      expect(OnboardingSchema.safeParse({ ...validData, dailyEnergyLimit: 4 }).success).toBe(true);
      expect(OnboardingSchema.safeParse({ ...validData, dailyEnergyLimit: 60 }).success).toBe(true);
    });

    it('rejects invalid timezone', () => {
      expect(OnboardingSchema.safeParse({ ...validData, timezone: 'Unknown/Zone' }).success).toBe(false);
    });

    it('rejects empty or overly long display name', () => {
      expect(OnboardingSchema.safeParse({ ...validData, displayName: '   ' }).success).toBe(false);
      expect(OnboardingSchema.safeParse({ ...validData, displayName: 'a'.repeat(51) }).success).toBe(false);
      expect(OnboardingSchema.safeParse({ ...validData, displayName: 'a'.repeat(50) }).success).toBe(true);
    });
  });

  describe('ProfileUpdateSchema', () => {
    it('accepts partial updates', () => {
      expect(ProfileUpdateSchema.safeParse({ dailyEnergyLimit: 25 }).success).toBe(true);
      expect(ProfileUpdateSchema.safeParse({ timezone: 'Europe/Warsaw' }).success).toBe(true);
    });

    it('validates window constraint when both start and end are provided', () => {
      expect(
        ProfileUpdateSchema.safeParse({ dayStart: '10:00', dayEnd: '09:00' }).success
      ).toBe(false);
      expect(
        ProfileUpdateSchema.safeParse({ dayStart: '08:00', dayEnd: '16:00' }).success
      ).toBe(true);
    });
  });
});
