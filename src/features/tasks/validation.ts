import * as z from 'zod';
import { normalizeSessionMinutes } from '@/domain/scheduler/session';
import { minutesToMs, zonedToInstant } from '@/domain/time';
import type { LocalTime } from '@/domain/types';
import { isValidIanaTimezone } from '@/features/profile/schemas';

const DEFAULT_DEADLINE_TIME: LocalTime = '23:59';

export function validateTaskTypeSelection(
  data: { readonly typeId?: string; readonly newOneOffTypeName?: string },
  ctx: z.RefinementCtx
): void {
  const hasTypeId = Boolean(data.typeId);
  const hasNewName = Boolean(data.newOneOffTypeName && data.newOneOffTypeName.trim().length > 0);

  if (!hasTypeId && !hasNewName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Wybierz typ zadania lub podaj nazwę typu jednorazowego',
      path: ['typeId'],
    });
    return;
  }

  if (hasTypeId && hasNewName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Wybierz typ zadania LUB podaj nazwę jednorazowego, nie oba naraz',
      path: ['newOneOffTypeName'],
    });
  }
}

export function validateFlexibleDeadline(
  data: {
    readonly deadlineDate?: string | null;
    readonly deadlineTime?: string | null;
    readonly timeZone?: string | null;
  },
  ctx: z.RefinementCtx
): void {
  if (!data.deadlineDate) {
    return;
  }
  if (!data.timeZone || !isValidIanaTimezone(data.timeZone)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Poprawna strefa czasowa IANA jest wymagana dla terminu',
      path: ['timeZone'],
    });
    return;
  }
  const time = (data.deadlineTime || DEFAULT_DEADLINE_TIME) as LocalTime;
  try {
    zonedToInstant(data.deadlineDate, time, data.timeZone);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Nieprawidłowa data lub godzina terminu',
      path: ['deadlineDate'],
    });
  }
}

function checkHardFields(
  data: {
    readonly date?: string;
    readonly startTime?: string;
    readonly durationMinutes?: number;
    readonly timeZone?: string | null;
  },
  ctx: z.RefinementCtx
): boolean {
  if (!data.date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Data jest wymagana', path: ['date'] });
  }
  if (!data.startTime) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Godzina rozpoczęcia jest wymagana', path: ['startTime'] });
  }
  if (data.durationMinutes === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Czas trwania jest wymagany', path: ['durationMinutes'] });
  }
  if (!data.timeZone || !isValidIanaTimezone(data.timeZone)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Strefa czasowa jest wymagana', path: ['timeZone'] });
  }
  return Boolean(
    data.date &&
      data.startTime &&
      data.durationMinutes !== undefined &&
      data.timeZone &&
      isValidIanaTimezone(data.timeZone)
  );
}

export function validateHardTask(
  data: {
    readonly fixation: 'flexible' | 'hard';
    readonly date?: string;
    readonly startTime?: string;
    readonly durationMinutes?: number;
    readonly timeZone?: string | null;
  },
  ctx: z.RefinementCtx
): void {
  if (data.fixation !== 'hard' || !checkHardFields(data, ctx)) {
    return;
  }
  try {
    zonedToInstant(data.date!, data.startTime as LocalTime, data.timeZone!);
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nieprawidłowa data lub godzina rozpoczęcia', path: ['startTime'] });
  }
}

export function computeDeadline(data: {
  readonly deadlineDate?: string | null;
  readonly deadlineTime?: string | null;
  readonly timeZone?: string | null;
  readonly deadline?: string | null;
}): { readonly deadline: string | null; readonly deadlineInstant: number | null } {
  if (data.deadlineDate && data.timeZone) {
    const time = (data.deadlineTime || DEFAULT_DEADLINE_TIME) as LocalTime;
    const instant = zonedToInstant(data.deadlineDate, time, data.timeZone);
    return { deadline: new Date(instant).toISOString(), deadlineInstant: instant };
  }
  if (data.deadline) {
    return { deadline: data.deadline, deadlineInstant: Date.parse(data.deadline) };
  }
  return { deadline: null, deadlineInstant: null };
}

export function computeHardInterval(data: {
  readonly fixation: 'flexible' | 'hard';
  readonly date?: string;
  readonly startTime?: string;
  readonly timeZone?: string | null;
  readonly durationMinutes?: number;
}): {
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly startsAtInstant?: number;
  readonly endsAtInstant?: number;
} {
  if (
    data.fixation !== 'hard' ||
    !data.date ||
    !data.startTime ||
    !data.timeZone ||
    data.durationMinutes === undefined
  ) {
    return {};
  }
  const startsAtInstant = zonedToInstant(data.date, data.startTime as LocalTime, data.timeZone);
  const endsAtInstant = startsAtInstant + minutesToMs(data.durationMinutes);
  return {
    startsAt: new Date(startsAtInstant).toISOString(),
    endsAt: new Date(endsAtInstant).toISOString(),
    startsAtInstant,
    endsAtInstant,
  };
}

export function normalizeSessionValue(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return normalizeSessionMinutes(value);
}
