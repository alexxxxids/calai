import { toast } from 'sonner';

import {
  ISO_WEEKDAY_MAX,
  ISO_WEEKDAY_MIN,
  RECURRING_EVENT_TITLE_MAX_LENGTH,
} from '../schemas';
import type { RecurringEventWithRelations } from '../types';

export const DEFAULT_START_TIME = '08:00';
export const DEFAULT_END_TIME = '08:45';
export const DEFAULT_WEEKDAY = 1;
export const DEFAULT_WARSAW_TIMEZONE = 'Europe/Warsaw';

export const TIME_DISPLAY_LENGTH = 5;
export const WEDNESDAY = 3;
export const THURSDAY = 4;
export const FRIDAY = 5;
export const SATURDAY = 6;
export const SUNDAY = 7;

export interface WeekdayOption {
  readonly value: number;
  readonly label: string;
}

export const WEEKDAYS: readonly WeekdayOption[] = [
  { value: 1, label: 'Poniedziałek' },
  { value: 2, label: 'Wtorek' },
  { value: WEDNESDAY, label: 'Środa' },
  { value: THURSDAY, label: 'Czwartek' },
  { value: FRIDAY, label: 'Piątek' },
  { value: SATURDAY, label: 'Sobota' },
  { value: SUNDAY, label: 'Niedziela' },
];

export function getWeekdayLabel(weekday: number): string {
  const match = WEEKDAYS.find((d) => d.value === weekday);
  return match?.label ?? `Dzień ${weekday}`;
}

export function formatTimeShort(time: string): string {
  return time.length >= TIME_DISPLAY_LENGTH ? time.slice(0, TIME_DISPLAY_LENGTH) : time;
}

export function formatEventTimeRange(startTime: string, endTime: string): string {
  return `${formatTimeShort(startTime)} – ${formatTimeShort(endTime)}`;
}

export function groupEventsByWeekday(
  events?: readonly RecurringEventWithRelations[],
): Map<number, RecurringEventWithRelations[]> {
  const map = new Map<number, RecurringEventWithRelations[]>();
  for (const event of events ?? []) {
    const list = map.get(event.weekday) ?? [];
    list.push(event);
    map.set(event.weekday, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }
  return map;
}

export interface RecurringEventFormValues {
  readonly title: string;
  readonly typeId: string;
  readonly weekday: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly validFrom: string;
  readonly validUntil?: string;
}

export interface FormValidationResult {
  readonly isValid: boolean;
  readonly error?: string;
}

function validateEventTitleAndType(title: string, typeId: string): string | undefined {
  const trimmedTitle = title.trim();
  if (trimmedTitle.length < 1) {
    return 'Nazwa zajęć jest wymagana';
  }
  if (trimmedTitle.length > RECURRING_EVENT_TITLE_MAX_LENGTH) {
    return `Nazwa zajęć może mieć maksymalnie ${RECURRING_EVENT_TITLE_MAX_LENGTH} znaków`;
  }
  if (!typeId) {
    return 'Wybierz typ zadania';
  }
  return undefined;
}

function toComparableTime(time: string): string {
  return time.length === TIME_DISPLAY_LENGTH ? `${time}:00` : time;
}

function validateEventTimeRange(startTime: string, endTime: string): string | undefined {
  if (!startTime || !endTime) {
    return 'Podaj czas rozpoczęcia i zakończenia';
  }
  if (toComparableTime(endTime) <= toComparableTime(startTime)) {
    return 'Czas zakończenia musi być późniejszy niż czas rozpoczęcia';
  }
  return undefined;
}

function validateEventValidityDates(validFrom: string, validUntil?: string): string | undefined {
  if (!validFrom) {
    return 'Podaj datę początkową';
  }
  const trimmedUntil = validUntil?.trim();
  if (trimmedUntil && trimmedUntil < validFrom) {
    return 'Data końcowa nie może być wcześniejsza niż początkowa';
  }
  return undefined;
}

export function validateRecurringEventForm(
  values: RecurringEventFormValues,
): FormValidationResult {
  const titleTypeError = validateEventTitleAndType(values.title, values.typeId);
  if (titleTypeError) {
    return { isValid: false, error: titleTypeError };
  }
  if (values.weekday < ISO_WEEKDAY_MIN || values.weekday > ISO_WEEKDAY_MAX) {
    return { isValid: false, error: 'Dzień tygodnia musi być między 1 a 7' };
  }
  const timeError = validateEventTimeRange(values.startTime, values.endTime);
  if (timeError) {
    return { isValid: false, error: timeError };
  }
  const dateError = validateEventValidityDates(values.validFrom, values.validUntil);
  if (dateError) {
    return { isValid: false, error: dateError };
  }
  return { isValid: true };
}


export interface ActionResultLike {
  readonly ok: boolean;
  readonly error?: string;
}

export async function executeCreateRecurringEvent(
  action: () => Promise<ActionResultLike>,
  onSuccess: () => void,
): Promise<void> {
  try {
    const res = await action();
    if (res.ok) {
      toast.success('Dodano zajęcia do planu lekcji');
      onSuccess();
    } else {
      toast.error(res.error ?? 'Nie udało się dodać zajęć');
    }
  } catch {
    toast.error('Błąd połączenia');
  }
}

export async function executeDeleteRecurringEvent(
  action: () => Promise<ActionResultLike>,
  onSuccess: () => void,
): Promise<void> {
  try {
    const res = await action();
    if (res.ok) {
      toast.success('Usunięto zajęcia z planu lekcji');
      onSuccess();
    } else {
      toast.error(res.error ?? 'Nie udało się usunąć zajęć');
    }
  } catch {
    toast.error('Błąd połączenia');
  }
}

export async function submitRecurringEvent(
  values: RecurringEventFormValues,
  createAction: (input: unknown) => Promise<ActionResultLike>,
  onSuccess: () => void,
): Promise<void> {
  const validation = validateRecurringEventForm(values);
  if (!validation.isValid) {
    toast.error(validation.error ?? 'Nieprawidłowe dane formularza');
    return;
  }

  await executeCreateRecurringEvent(
    () =>
      createAction({
        events: [
          {
            title: values.title.trim(),
            typeId: values.typeId,
            weekday: values.weekday,
            startTime: values.startTime,
            endTime: values.endTime,
            validFrom: values.validFrom,
            validUntil: values.validUntil?.trim() ? values.validUntil : undefined,
          },
        ],
      }),
    onSuccess,
  );
}

