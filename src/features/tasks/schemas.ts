import * as z from 'zod';
import {
  computeDeadline,
  computeHardInterval,
  normalizeSessionValue,
  validateFlexibleDeadline,
  validateHardTask,
  validateTaskTypeSelection,
} from './validation';

export {
  calculatePacePreview,
  formatPacePreview,
  normalizeTaskSession,
  type PacePreview,
} from './pace-preview';

export const MIN_ESTIMATE_MINUTES = 5;
export const MAX_ESTIMATE_MINUTES = 6000;
export const MIN_SESSION_MINUTES = 30;
export const MAX_SESSION_MINUTES = 180;
export const SESSION_GRID_STEP = 15;
export const MIN_PRIORITY = 1;
export const MAX_PRIORITY = 3;
export const DEFAULT_PRIORITY = 2;
export const MIN_HARD_DURATION = 15;
export const MAX_HARD_DURATION = 720;
export const MAX_NOTES_LENGTH = 2000;
export const MIN_TYPE_NAME_LENGTH = 1;
export const MAX_TYPE_NAME_LENGTH = 60;
export const DEFAULT_ONE_OFF_COLOR = '#64748b';
export const DEFAULT_ONE_OFF_ENERGY = 2;

const flexibleFields = {
  notes: z.string().max(MAX_NOTES_LENGTH, 'Notatka może mieć maksymalnie 2000 znaków').nullable().optional(),
  estimateMinutes: z.coerce
    .number()
    .int('Szacowany czas musi być liczbą całkowitą')
    .min(MIN_ESTIMATE_MINUTES, 'Minimalny czas to 5 minut')
    .max(MAX_ESTIMATE_MINUTES, 'Maksymalny czas to 6000 minut (100 godzin)')
    .nullable()
    .optional(),
  sessionMinutes: z.coerce
    .number()
    .int('Długość sesji musi być liczbą całkowitą')
    .min(MIN_SESSION_MINUTES, 'Minimalna długość sesji to 30 minut')
    .max(MAX_SESSION_MINUTES, 'Maksymalna długość sesji to 180 minut')
    .nullable()
    .optional(),
  deadlineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nieprawidłowy format daty (RRRR-MM-DD)').nullable().optional(),
  deadlineTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Nieprawidłowy format godziny (GG:MM)').nullable().optional(),
  timeZone: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
};

const RawCreateTaskSchema = z
  .object({
    ...flexibleFields,
    typeId: z.string().uuid('Nieprawidłowy identyfikator typu zadania').optional(),
    newOneOffTypeName: z
      .string()
      .trim()
      .min(MIN_TYPE_NAME_LENGTH, 'Nazwa typu nie może być pusta')
      .max(MAX_TYPE_NAME_LENGTH, 'Nazwa typu może mieć maksymalnie 60 znaków')
      .optional(),
    priority: z.coerce
      .number()
      .int('Priorytet musi być liczbą całkowitą')
      .min(MIN_PRIORITY, 'Minimalny priorytet to 1')
      .max(MAX_PRIORITY, 'Maksymalny priorytet to 3')
      .default(DEFAULT_PRIORITY),
    fixation: z.enum(['flexible', 'hard']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nieprawidłowy format daty (RRRR-MM-DD)').optional(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Nieprawidłowy format godziny (GG:MM)').optional(),
    durationMinutes: z.coerce
      .number()
      .int('Czas trwania musi być liczbą całkowitą')
      .min(MIN_HARD_DURATION, 'Minimalny czas trwania to 15 minut')
      .max(MAX_HARD_DURATION, 'Maksymalny czas trwania to 720 minut')
      .optional(),
  })
  .superRefine((data, ctx) => {
    validateTaskTypeSelection(data, ctx);
    validateFlexibleDeadline(data, ctx);
    validateHardTask(data, ctx);
  });

function transformCreateTask(data: z.infer<typeof RawCreateTaskSchema>) {
  const { deadline, deadlineInstant } = computeDeadline(data);
  const hardInterval = computeHardInterval(data);
  const sessionMinutes = normalizeSessionValue(data.sessionMinutes);

  return {
    ...data,
    sessionMinutes,
    deadline,
    deadlineInstant,
    ...hardInterval,
    notes: data.notes ?? null,
    estimateMinutes: data.estimateMinutes ?? null,
  };
}

export const CreateTaskSchema = RawCreateTaskSchema.transform(transformCreateTask);
export type CreateTaskInput = z.input<typeof CreateTaskSchema>;
export type CreateTaskPayload = z.output<typeof CreateTaskSchema>;

const RawUpdateTaskSchema = z
  .object({
    ...flexibleFields,
    id: z.string().uuid('Nieprawidłowy identyfikator zadania').optional(),
    taskId: z.string().uuid('Nieprawidłowy identyfikator zadania').optional(),
    typeId: z.string().uuid('Nieprawidłowy identyfikator typu zadania').optional(),
    priority: z.coerce
      .number()
      .int('Priorytet musi być liczbą całkowitą')
      .min(MIN_PRIORITY, 'Minimalny priorytet to 1')
      .max(MAX_PRIORITY, 'Maksymalny priorytet to 3')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.id && !data.taskId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Identyfikator zadania jest wymagany', path: ['id'] });
    }
    validateFlexibleDeadline(data, ctx);
  });

function transformUpdateTask(data: z.infer<typeof RawUpdateTaskSchema>) {
  const id = (data.id ?? data.taskId)!;
  const { deadline, deadlineInstant } = computeDeadline(data);
  const sessionMinutes =
    data.sessionMinutes === undefined ? undefined : normalizeSessionValue(data.sessionMinutes);

  return {
    ...data,
    id,
    taskId: id,
    sessionMinutes,
    deadline,
    deadlineInstant,
  };
}

export const UpdateTaskSchema = RawUpdateTaskSchema.transform(transformUpdateTask);
export type UpdateTaskInput = z.input<typeof UpdateTaskSchema>;
export type UpdateTaskPayload = z.output<typeof UpdateTaskSchema>;

const TaskIdPayloadSchema = z
  .object({
    taskId: z.string().uuid('Nieprawidłowy identyfikator zadania').optional(),
    id: z.string().uuid('Nieprawidłowy identyfikator zadania').optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.taskId && !data.id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Identyfikator zadania jest wymagany', path: ['taskId'] });
    }
  })
  .transform((data) => {
    const id = (data.taskId ?? data.id)!;
    return { taskId: id, id };
  });

export const CompleteTaskSchema = TaskIdPayloadSchema;
export type CompleteTaskInput = z.input<typeof CompleteTaskSchema>;
export type CompleteTaskPayload = z.output<typeof CompleteTaskSchema>;

export const CancelTaskSchema = TaskIdPayloadSchema;
export type CancelTaskInput = z.input<typeof CancelTaskSchema>;
export type CancelTaskPayload = z.output<typeof CancelTaskSchema>;
