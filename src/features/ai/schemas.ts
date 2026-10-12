import * as z from 'zod';
import { MAX_SESSION, MIN_SESSION, PRIORITY, SLOT } from '@/domain/constants';

// ── What the model must return (docs/algorithms.md §7) ─────────────────────────
// The same schema becomes the JSON Schema sent to Gemini and the check of its answer.

const TIME_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const MAX_SUMMARY_LENGTH = 300;
export const MAX_TOPIC_TITLE_LENGTH = 120;
export const MIN_TOPIC_WORK_MINUTES_AI = 10;
export const MAX_TOPIC_WORK_MINUTES = 600;
export const MIN_TOPIC_WORK_MINUTES_DRAFT = 5;
export const MAX_TOPICS_COUNT = 40;
export const MAX_WARNING_LENGTH = 200;
export const MAX_WARNINGS_COUNT = 5;
export const ISO_WEEKDAY_MAX = 7;
export const EVENT_TITLE_MAX = 80; // recurring_events.title in SQL
export const TIMETABLE_EVENTS_MAX_COUNT = 80;

export const DecompositionSchema = z.object({
  summary: z.string().min(1).max(MAX_SUMMARY_LENGTH),
  sessionMinutes: z.number().int().min(MIN_SESSION).max(MAX_SESSION),
  topics: z
    .array(
      z.object({
        title: z.string().min(1).max(MAX_TOPIC_TITLE_LENGTH),
        workMinutes: z.number().int().min(MIN_TOPIC_WORK_MINUTES_AI).max(MAX_TOPIC_WORK_MINUTES),
      }),
    )
    .min(1)
    .max(MAX_TOPICS_COUNT),
  warnings: z.array(z.string().max(MAX_WARNING_LENGTH)).max(MAX_WARNINGS_COUNT),
});
export type Decomposition = z.infer<typeof DecompositionSchema>;

export const TimetableSchema = z.object({
  events: z
    .array(
      z
        .object({
          title: z.string().trim().min(1).max(EVENT_TITLE_MAX),
          weekday: z.number().int().min(1).max(ISO_WEEKDAY_MAX),
          startTime: z.string().regex(TIME_HH_MM),
          endTime: z.string().regex(TIME_HH_MM),
        })
        .refine(
          (event) => event.endTime > event.startTime,
          'Czas zakończenia musi być późniejszy niż rozpoczęcia.',
        ),
    )
    .max(TIMETABLE_EVENTS_MAX_COUNT),
  warnings: z.array(z.string().max(MAX_WARNING_LENGTH)).max(MAX_WARNINGS_COUNT),
});
export type Timetable = z.infer<typeof TimetableSchema>;

// ── Shared field rules (the same limits as the SQL checks) ─────────────────────

/** A day as 'YYYY-MM-DD' that exists in the calendar. */
export const LocalDateSchema = z.iso.date({ error: 'Podaj poprawną datę.' });
/** A wall-clock time 'HH:mm'. */
export const LocalTimeSchema = z.iso.time({ precision: -1, error: 'Podaj godzinę jako GG:MM.' });

const DATE_TIME_ERROR = 'Podaj poprawną datę i godzinę.';
/** What <input type="datetime-local"> sends: 'YYYY-MM-DDTHH:mm', a wall-clock time without a zone. */
export const LocalDateTimeSchema = z
  .string({ error: DATE_TIME_ERROR })
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, DATE_TIME_ERROR)
  .refine((value) => {
    const [date = '', time = ''] = value.split('T');
    return LocalDateSchema.safeParse(date).success && LocalTimeSchema.safeParse(time).success;
  }, DATE_TIME_ERROR);

export const TypeIdSchema = z.uuid({ error: 'Wybierz typ zadania.' });

/** tasks.estimate_minutes is 5–6000 in SQL: at most 100 hours. */
export const MAX_ESTIMATE_MINUTES = 6000;
/** tasks.notes is at most 2000 characters in SQL. */
export const MAX_NOTES_LENGTH = 2000;
/** The user's description goes into the prompt; a short one is enough to explain the file. */
export const MAX_DESCRIPTION_LENGTH = 1000;

// ── Requests to POST /api/ai/* (the file itself is already in storage) ────────

const DescriptionSchema = z
  .string()
  .trim()
  .max(MAX_DESCRIPTION_LENGTH, `Opis może mieć maksymalnie ${MAX_DESCRIPTION_LENGTH} znaków.`);

export const DecomposeRequestSchema = z.object({
  path: z.string().min(1),
  typeId: TypeIdSchema.nullable().optional(),
  deadline: LocalDateTimeSchema.nullable().optional(),
  description: DescriptionSchema,
});
export type DecomposeRequest = z.infer<typeof DecomposeRequestSchema>;

export const TimetableRequestSchema = z.object({
  path: z.string().min(1),
  description: DescriptionSchema,
});
export type TimetableRequest = z.infer<typeof TimetableRequestSchema>;

// ── Drafts: what our API returns and the user edits ────────────────────────────

const TopicTitleSchema = z
  .string()
  .trim()
  .min(1, 'Wpisz nazwę tematu.')
  .max(MAX_TOPIC_TITLE_LENGTH, `Nazwa tematu może mieć maksymalnie ${MAX_TOPIC_TITLE_LENGTH} znaków.`);

export const TopicSchema = z.object({
  title: TopicTitleSchema,
  workMinutes: z
    .number({ error: 'Wpisz liczbę minut.' })
    .int('Wpisz pełne minuty.')
    .min(MIN_TOPIC_WORK_MINUTES_DRAFT, 'Temat to co najmniej 5 minut.')
    .max(MAX_TOPIC_WORK_MINUTES, 'Temat to najwyżej 600 minut — podziel go na mniejsze.'),
});
export type Topic = z.infer<typeof TopicSchema>;

export const SessionMinutesSchema = z
  .number()
  .int()
  .min(MIN_SESSION)
  .max(MAX_SESSION)
  .multipleOf(SLOT, 'Długość bloku musi być wielokrotnością 15 minut.');

export const DecompositionDraftSchema = z.object({
  summary: z.string(),
  sessionMinutes: SessionMinutesSchema,
  estimateMinutes: z.number().int(),
  topics: z.array(TopicSchema),
  warnings: z.array(z.string()),
});
export type DecompositionDraft = z.infer<typeof DecompositionDraftSchema>;

export const TimetableEventSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Wpisz nazwę zajęć.')
      .max(EVENT_TITLE_MAX, `Nazwa może mieć maksymalnie ${EVENT_TITLE_MAX} znaków.`),
    weekday: z.number().int().min(1).max(ISO_WEEKDAY_MAX),
    startTime: LocalTimeSchema,
    endTime: LocalTimeSchema,
  })
  // 'HH:mm' strings compare like the times they name.
  .refine((event) => event.endTime > event.startTime, {
    path: ['endTime'],
    error: 'Koniec musi być później niż początek.',
  });
export type TimetableEvent = z.infer<typeof TimetableEventSchema>;

export const TimetableDraftSchema = z.object({
  events: z.array(TimetableEventSchema),
  warnings: z.array(z.string()),
  validFrom: LocalDateSchema,
  validUntil: LocalDateSchema,
});
export type TimetableDraft = z.infer<typeof TimetableDraftSchema>;

// ── Confirmation: the edited draft becomes data (Server Actions) ──────────────

export const ConfirmDecompositionSchema = z
  .object({
    typeId: TypeIdSchema,
    priority: z.union([z.literal(PRIORITY.high), z.literal(PRIORITY.normal), z.literal(PRIORITY.low)], {
      error: 'Wybierz priorytet.',
    }),
    deadline: LocalDateTimeSchema.nullable().optional(),
    sessionMinutes: SessionMinutesSchema,
    topics: z.array(TopicSchema).min(1, 'Zostaw co najmniej jeden temat.').max(MAX_TOPICS_COUNT),
  })
  .refine((draft) => totalWorkMinutes(draft.topics) <= MAX_ESTIMATE_MINUTES, {
    path: ['topics'],
    error: 'Razem to więcej niż 100 godzin. Podziel materiał na kilka zadań.',
  });
export type ConfirmDecompositionInput = z.infer<typeof ConfirmDecompositionSchema>;

export const ConfirmTimetableSchema = z
  .object({
    typeId: TypeIdSchema,
    validFrom: LocalDateSchema,
    validUntil: LocalDateSchema,
    events: z.array(TimetableEventSchema).min(1, 'Zostaw co najmniej jedne zajęcia.').max(TIMETABLE_EVENTS_MAX_COUNT),
  })
  .refine((draft) => draft.validUntil >= draft.validFrom, {
    path: ['validUntil'],
    error: 'Data końca nie może być wcześniejsza niż data początku.',
  });
export type ConfirmTimetableInput = z.infer<typeof ConfirmTimetableSchema>;

export function totalWorkMinutes(topics: readonly { workMinutes: number }[]): number {
  return topics.reduce((sum, topic) => sum + topic.workMinutes, 0);
}
