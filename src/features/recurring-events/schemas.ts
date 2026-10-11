import * as z from 'zod';

export const RECURRING_EVENT_TITLE_MIN_LENGTH = 1;
export const RECURRING_EVENT_TITLE_MAX_LENGTH = 80;
export const ISO_WEEKDAY_MIN = 1;
export const ISO_WEEKDAY_MAX = 7;
export const RECURRING_EVENTS_MIN_BATCH = 1;
export const RECURRING_EVENTS_MAX_BATCH = 50;

export const POSTGRES_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const TIME_SHORT_LENGTH = 5;

function toComparableTime(time: string): string {
  return time.length === TIME_SHORT_LENGTH ? `${time}:00` : time;
}

export const RecurringEventItemSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(
        RECURRING_EVENT_TITLE_MIN_LENGTH,
        'Nazwa wydarzenia jest wymagana',
      )
      .max(
        RECURRING_EVENT_TITLE_MAX_LENGTH,
        `Nazwa wydarzenia może mieć maksymalnie ${RECURRING_EVENT_TITLE_MAX_LENGTH} znaków`,
      ),
    typeId: z.string().uuid('Nieprawidłowy identyfikator typu'),
    weekday: z
      .number()
      .int('Dzień tygodnia musi być liczbą całkowitą')
      .min(ISO_WEEKDAY_MIN, 'Dzień tygodnia musi być między 1 a 7')
      .max(ISO_WEEKDAY_MAX, 'Dzień tygodnia musi być między 1 a 7'),
    startTime: z
      .string()
      .regex(
        POSTGRES_TIME_REGEX,
        'Nieprawidłowy format czasu rozpoczęcia (oczekiwano HH:mm lub HH:mm:ss)',
      ),
    endTime: z
      .string()
      .regex(
        POSTGRES_TIME_REGEX,
        'Nieprawidłowy format czasu zakończenia (oczekiwano HH:mm lub HH:mm:ss)',
      ),
    validFrom: z
      .string()
      .regex(
        ISO_DATE_REGEX,
        'Nieprawidłowy format daty początkowej (oczekiwano YYYY-MM-DD)',
      ),
    validUntil: z
      .string()
      .regex(
        ISO_DATE_REGEX,
        'Nieprawidłowy format daty końcowej (oczekiwano YYYY-MM-DD)',
      )
      .nullable()
      .optional(),
  })
  .refine(
    (data) => toComparableTime(data.endTime) > toComparableTime(data.startTime),
    {
      message: 'Czas zakończenia musi być późniejszy niż czas rozpoczęcia',
      path: ['endTime'],
    },
  )
  .refine(
    (data) => !data.validUntil || data.validUntil >= data.validFrom,
    {
      message: 'Data końcowa nie może być wcześniejsza niż początkowa',
      path: ['validUntil'],
    },
  );

export const CreateRecurringEventSchema = RecurringEventItemSchema;

export const CreateRecurringEventsSchema = z.object({
  events: z
    .array(RecurringEventItemSchema)
    .min(
      RECURRING_EVENTS_MIN_BATCH,
      'Wymagane jest co najmniej jedno wydarzenie',
    )
    .max(
      RECURRING_EVENTS_MAX_BATCH,
      `Maksymalnie ${RECURRING_EVENTS_MAX_BATCH} wydarzeń w jednej operacji`,
    ),
});

export const DeleteRecurringEventSchema = z.object({
  id: z.string().uuid('Nieprawidłowy identyfikator wydarzenia'),
});

export type CreateRecurringEventInput = z.infer<typeof CreateRecurringEventSchema>;
export type CreateRecurringEventsInput = z.infer<typeof CreateRecurringEventsSchema>;
export type DeleteRecurringEventInput = z.infer<typeof DeleteRecurringEventSchema>;
