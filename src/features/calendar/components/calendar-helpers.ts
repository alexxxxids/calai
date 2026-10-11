import { MS_PER_MINUTE } from '@/domain/constants';
import { instantToLocalDate, zonedToInstant } from '@/domain/time';
import { formatTime } from '@/lib/format';
import type { BlockStatus } from '@/types/db';
import type { CalendarEventItem } from '../types';

export const DEFAULT_DROP_DURATION_MINUTES = 90;
export const MINUTES_IN_HOUR = 60;
export const DEFAULT_WORK_START = '08:00';
export const MIN_ACTUAL_MINUTES = 1;
export const MAX_ACTUAL_MINUTES = 1440;
export const DEFAULT_WARSAW_TIMEZONE = 'Europe/Warsaw';
export const DEFAULT_ENERGY_LEVEL = 1;

const ISO_DATE_LENGTH = 10;
const DURATION_PATTERN = /^(\d{1,2}):(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

export interface EventStatusBadge {
  readonly text: string;
  readonly variant: 'default' | 'secondary' | 'destructive' | 'outline';
}

export const STATUS_BADGE_MAP = {
  planned: { text: 'Zaplanowany', variant: 'outline' },
  done: { text: 'Wykonano', variant: 'default' },
  missed: { text: 'Pominięto', variant: 'destructive' },
} as const satisfies Record<BlockStatus, EventStatusBadge>;

const DEFAULT_STATUS_BADGE: EventStatusBadge = {
  text: 'Zaplanowany',
  variant: 'outline',
};

const VALID_STATUSES: ReadonlySet<string> = new Set(['planned', 'done', 'missed']);

function isBlockStatus(status: unknown): status is BlockStatus {
  return typeof status === 'string' && status in STATUS_BADGE_MAP;
}

function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * Parses duration strings in "HH:MM" format (e.g. from backlog data-duration) into minutes.
 * Falls back to DEFAULT_DROP_DURATION_MINUTES if string is absent, invalid, or non-positive.
 */
export function parseDurationToMinutes(durationStr: string | null | undefined): number {
  if (!durationStr) {
    return DEFAULT_DROP_DURATION_MINUTES;
  }
  const match = DURATION_PATTERN.exec(durationStr);
  if (!match) {
    return DEFAULT_DROP_DURATION_MINUTES;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    minutes < 0 ||
    minutes >= MINUTES_IN_HOUR
  ) {
    return DEFAULT_DROP_DURATION_MINUTES;
  }
  const total = hours * MINUTES_IN_HOUR + minutes;
  if (total <= 0) {
    return DEFAULT_DROP_DURATION_MINUTES;
  }
  return total;
}

/**
 * Formats a Date object's local calendar day to "YYYY-MM-DD" without timezone conversion.
 * Used for date picker inputs where the Date object represents the selected local day.
 */
export function dateToYmdString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractDropLocalDate(date: Date, timeZone: string): string {
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
    return date.toISOString().slice(0, ISO_DATE_LENGTH);
  }
  return instantToLocalDate(date.getTime(), timeZone);
}

/**
 * Calculates start ISO instant for event drop.
 * When not allDay, preserves exact dropped instant.
 * When allDay (e.g. dropped on day column header or month grid), sets start to workStart in target timeZone.
 */
export function calculateDropStartIso(
  date: Date,
  allDay: boolean,
  workStart: string,
  timeZone: string,
): string {
  if (!allDay) {
    return date.toISOString();
  }
  const localDate = extractDropLocalDate(date, timeZone);
  const normalizedWorkStart = TIME_PATTERN.test(workStart) ? workStart : DEFAULT_WORK_START;
  const instant = zonedToInstant(localDate, normalizedWorkStart, timeZone);
  return new Date(instant).toISOString();
}

/**
 * Formats start and end times into localized range string (e.g. "08:00 – 09:30").
 */
export function formatEventTimeRange(
  start: Date | null | undefined,
  end: Date | null | undefined,
  timeZone: string,
): string {
  const startStr = isValidDate(start) ? formatTime(start, timeZone) : '';
  const endStr = isValidDate(end) ? formatTime(end, timeZone) : '';

  if (startStr && endStr) {
    return `${startStr} – ${endStr}`;
  }
  return startStr || endStr;
}

/**
 * Maps block status to localized text and badge visual variant.
 */
export function getEventStatusBadge(status: string | null | undefined): EventStatusBadge {
  if (isBlockStatus(status)) {
    return STATUS_BADGE_MAP[status];
  }
  return DEFAULT_STATUS_BADGE;
}

export interface ActualMinutesValidation {
  readonly isValid: boolean;
  readonly minutes?: number;
  readonly error?: string;
}

/**
 * Calculates duration between two ISO or Date instants in minutes.
 * Returns 0 if either instant is invalid, missing, or if end is before/equal start.
 */
export function calculateBlockDurationMinutes(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): number {
  if (!start || !end) {
    return 0;
  }
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return 0;
  }
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.round(diffMs / MS_PER_MINUTE);
}

/**
 * Validates actual minutes input for closing a block.
 * Value must be an integer between MIN_ACTUAL_MINUTES (1) and MAX_ACTUAL_MINUTES (1440).
 */
export function validateActualMinutes(value: unknown): ActualMinutesValidation {
  if (value === null || value === undefined || value === '') {
    return { isValid: false, error: 'Podaj liczbę minut' };
  }
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return { isValid: false, error: 'Czas musi być liczbą całkowitą' };
  }
  if (num < MIN_ACTUAL_MINUTES) {
    return { isValid: false, error: `Minimalny czas to ${MIN_ACTUAL_MINUTES} minuta` };
  }
  if (num > MAX_ACTUAL_MINUTES) {
    return { isValid: false, error: `Maksymalny czas to ${MAX_ACTUAL_MINUTES} minut` };
  }
  return { isValid: true, minutes: num };
}

/**
 * Checks whether a calendar event is an actionable task block (kind === 'block' and status === 'planned').
 */
export function isBlockActionable(block: CalendarEventItem | null | undefined): boolean {
  if (!block) {
    return false;
  }
  return block.extendedProps.kind === 'block' && block.extendedProps.status === 'planned';
}

export function parseBlockStatus(raw: unknown): BlockStatus | null {
  if (typeof raw === 'string' && VALID_STATUSES.has(raw)) {
    // Type assertion is safe because status is checked against VALID_STATUSES set
    return raw as BlockStatus;
  }
  return null;
}

function getIsoOrFallback(date: Date | null, fallback: string): string {
  return date ? date.toISOString() : fallback;
}

function getStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export interface CalendarEventLike {
  readonly id: string;
  readonly title: string;
  readonly start: Date | null;
  readonly end: Date | null;
  readonly startStr: string;
  readonly endStr: string;
  readonly color?: string;
  readonly startEditable?: boolean;
  readonly extendedProps: Record<string, unknown>;
}

export function extractBlockFromEvent(event: CalendarEventLike): CalendarEventItem | null {
  const ext = event.extendedProps;
  if (ext.kind !== 'block') {
    return null;
  }
  const colorStr = event.color ?? '';
  const editableBool = event.startEditable ?? true;
  const energyVal = typeof ext.energy === 'number' ? ext.energy : DEFAULT_ENERGY_LEVEL;

  return {
    id: event.id,
    title: event.title,
    start: getIsoOrFallback(event.start, event.startStr),
    end: getIsoOrFallback(event.end, event.endStr),
    color: colorStr,
    editable: editableBool,
    extendedProps: {
      kind: 'block',
      status: parseBlockStatus(ext.status),
      pinned: Boolean(ext.pinned),
      taskId: getStringOrNull(ext.taskId),
      energy: energyVal,
      typeId: getStringOrNull(ext.typeId),
    },
  };
}

export interface ResolveDropInstantsParams {
  readonly eventStart: Date | null;
  readonly eventEnd: Date | null;
  readonly eventStartStr: string;
  readonly allDay: boolean;
  readonly oldStart: Date | null;
  readonly oldEnd: Date | null;
  readonly workStart: string;
  readonly timeZone: string;
}

export function resolveDropInstants(params: ResolveDropInstantsParams): { start: string; end: string } {
  const start = params.eventStart
    ? calculateDropStartIso(params.eventStart, params.allDay, params.workStart, params.timeZone)
    : params.eventStartStr;

  if (params.eventEnd && !params.allDay) {
    return { start, end: params.eventEnd.toISOString() };
  }

  const oldDurationMs =
    params.oldStart && params.oldEnd
      ? params.oldEnd.getTime() - params.oldStart.getTime()
      : DEFAULT_DROP_DURATION_MINUTES * MS_PER_MINUTE;

  const end = new Date(Date.parse(start) + oldDurationMs).toISOString();
  return { start, end };
}
