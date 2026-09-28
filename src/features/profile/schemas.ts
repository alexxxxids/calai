import * as z from 'zod';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const POSTGRES_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const TIME_HH_MM_LENGTH = 5;
export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MIN_DAILY_ENERGY_LIMIT = 4;
export const MAX_DAILY_ENERGY_LIMIT = 60;
export const DEFAULT_DAILY_ENERGY_LIMIT = 20;

/**
 * Converts a Postgres TIME string ('HH:MM:SS' or 'HH:MM') to an HTML input format ('HH:MM').
 */
export function postgresToTime(timeStr: string): string {
  if (!POSTGRES_TIME_REGEX.test(timeStr)) {
    throw new Error(`Nieprawidłowy format czasu Postgres: ${timeStr}`);
  }
  return timeStr.slice(0, TIME_HH_MM_LENGTH);
}

/**
 * Converts an HTML input time string ('HH:MM') to a Postgres TIME format ('HH:MM:00').
 */
export function timeToPostgres(timeStr: string): string {
  if (!POSTGRES_TIME_REGEX.test(timeStr)) {
    throw new Error(`Nieprawidłowy format czasu: ${timeStr}`);
  }
  if (timeStr.length === TIME_HH_MM_LENGTH) {
    return `${timeStr}:00`;
  }
  return timeStr;
}

/**
 * Validates whether a given string is a valid IANA timezone name.
 * Excludes 'Factory' as specified by the database constraint.
 */
export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string' || tz === 'Factory') {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const TimeSchema = z
  .string()
  .regex(TIME_REGEX, 'Nieprawidłowy format czasu (oczekiwano GG:MM)');

export const ReflectionLevelSchema = z.enum(['basic', 'analytic', 'strategic'], {
  error: 'Nieprawidłowy poziom refleksji',
});

export const OnboardingSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Imię nie może być puste')
      .max(MAX_DISPLAY_NAME_LENGTH, 'Imię może mieć maksymalnie 50 znaków'),
    timezone: z
      .string()
      .refine(isValidIanaTimezone, 'Nieznana lub nieobsługiwana strefa czasowa'),
    dayStart: TimeSchema,
    dayEnd: TimeSchema,
    reflectionLevel: ReflectionLevelSchema,
    dailyEnergyLimit: z.coerce
      .number()
      .int('Limit musi być liczbą całkowitą')
      .min(MIN_DAILY_ENERGY_LIMIT, 'Minimalny limit to 4 punkty')
      .max(MAX_DAILY_ENERGY_LIMIT, 'Maksymalny limit to 60 punktów'),
  })
  .refine((data) => data.dayEnd > data.dayStart, {
    message: 'Koniec okna dnia musi być późniejszy niż początek',
    path: ['dayEnd'],
  });

export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export const ProfileUpdateSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Imię nie może быть puste')
      .max(MAX_DISPLAY_NAME_LENGTH, 'Imię może mieć maksymalnie 50 znaków')
      .optional(),
    timezone: z
      .string()
      .refine(isValidIanaTimezone, 'Nieznana lub nieobsługiwana strefa czasowa')
      .optional(),
    dayStart: TimeSchema.optional(),
    dayEnd: TimeSchema.optional(),
    reflectionLevel: ReflectionLevelSchema.optional(),
    dailyEnergyLimit: z.coerce
      .number()
      .int('Limit musi być liczbą całkowitą')
      .min(MIN_DAILY_ENERGY_LIMIT, 'Minimalny limit to 4 punkty')
      .max(MAX_DAILY_ENERGY_LIMIT, 'Maksymalny limit to 60 punktów')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.dayStart && data.dayEnd) {
        return data.dayEnd > data.dayStart;
      }
      return true;
    },
    {
      message: 'Koniec okna dnia musi być późniejszy niż początek',
      path: ['dayEnd'],
    }
  );

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

export const TimezoneUpdateSchema = z.object({
  timezone: z
    .string()
    .refine(isValidIanaTimezone, 'Nieznana lub nieobsługiwana strefa czasowa'),
});

export type TimezoneUpdateInput = z.infer<typeof TimezoneUpdateSchema>;

/**
 * Determines whether the timezone difference banner should be shown.
 */
export function shouldShowTimezoneBanner(
  browserTz: string | null,
  profileTz: string,
  isDismissed: boolean
): boolean {
  if (isDismissed || !browserTz || browserTz === 'Factory') {
    return false;
  }
  return browserTz !== profileTz;
}
