import * as z from 'zod';

export const MIN_RATING_SCORE = 1;
export const MAX_RATING_SCORE = 5;
export const MAX_WEEKLY_NOTE_LENGTH = 1000;
export const MAX_MONTHLY_TEXT_LENGTH = 4000;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])-01$/;

function optionalNullableText(maxLength: number, tooLongMessage: string) {
  return z
    .string()
    .max(maxLength, tooLongMessage)
    .nullable()
    .optional()
    .transform((val) => {
      if (val === undefined || val === null) {
        return null;
      }
      const trimmed = val.trim();
      return trimmed === '' ? null : trimmed;
    });
}

const ratingScoreSchema = (fieldName: string) =>
  z.coerce
    .number({
      error: `Wybierz ocenę dla pola ${fieldName} (1-5)`,
    })
    .int('Ocena musi być liczbą całkowitą')
    .min(MIN_RATING_SCORE, `Minimalna ocena to ${MIN_RATING_SCORE}`)
    .max(MAX_RATING_SCORE, `Maksymalna ocena to ${MAX_RATING_SCORE}`);

export const WeeklyReflectionSchema = z.object({
  weekStart: z
    .string({ error: 'Podaj datę początku tygodnia' })
    .regex(DATE_REGEX, 'Nieprawidłowy format daty (oczekiwano YYYY-MM-DD)'),
  fatigue: ratingScoreSchema('Zmęczenie'),
  stress: ratingScoreSchema('Stres'),
  focus: ratingScoreSchema('Skupienie'),
  distractions: ratingScoreSchema('Rozpraszacze'),
  note: optionalNullableText(
    MAX_WEEKLY_NOTE_LENGTH,
    `Notatka nie może przekraczać ${MAX_WEEKLY_NOTE_LENGTH} znaków`,
  ),
});

export type WeeklyReflectionInput = z.infer<typeof WeeklyReflectionSchema>;

export const MonthlyReflectionSchema = z.object({
  month: z
    .string({ error: 'Podaj miesiąc' })
    .regex(MONTH_REGEX, 'Nieprawidłowy format miesiąca (oczekiwano YYYY-MM-01)'),
  wentWell: optionalNullableText(
    MAX_MONTHLY_TEXT_LENGTH,
    `Pole "Co poszło dobrze" nie może przekraczać ${MAX_MONTHLY_TEXT_LENGTH} znaków`,
  ),
  wentBadly: optionalNullableText(
    MAX_MONTHLY_TEXT_LENGTH,
    `Pole "Co poszło źle" nie może przekraczać ${MAX_MONTHLY_TEXT_LENGTH} znaków`,
  ),
  typesReview: optionalNullableText(
    MAX_MONTHLY_TEXT_LENGTH,
    `Pole "Przegląd typów" nie może przekraczać ${MAX_MONTHLY_TEXT_LENGTH} znaków`,
  ),
  goalsNext: optionalNullableText(
    MAX_MONTHLY_TEXT_LENGTH,
    `Pole "Cele na kolejny miesiąc" nie może przekraczać ${MAX_MONTHLY_TEXT_LENGTH} znaków`,
  ),
  prioritiesChange: optionalNullableText(
    MAX_MONTHLY_TEXT_LENGTH,
    `Pole "Zmiana priorytetów" nie może przekraczać ${MAX_MONTHLY_TEXT_LENGTH} znaków`,
  ),
});

export type MonthlyReflectionInput = z.infer<typeof MonthlyReflectionSchema>;
