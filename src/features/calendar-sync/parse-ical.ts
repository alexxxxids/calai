import { randomUUID } from 'node:crypto';
import ical, { type CalendarResponse, type EventInstance, type VEvent } from 'node-ical';

export const MAX_EXTERNAL_EVENTS_PER_SUBSCRIPTION = 2500;
export const MAX_TITLE_LENGTH = 200;
export const DEFAULT_FALLBACK_TITLE = '(Wydarzenie zewnętrzne)';
// 15 minutes in milliseconds (15 * 60 * 1000)
export const DEFAULT_MINIMUM_DURATION_MS = 900_000;
// 24 hours in milliseconds (24 * 60 * 60 * 1000)
export const MS_PER_DAY = 86_400_000;

export interface ExternalEventPayload {
  readonly uid: string;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly title: string;
}

export interface ParseIcalOptions {
  readonly rangeStart: Date;
  readonly rangeEnd: Date;
  readonly fallbackTitle?: string;
}

function extractSummary(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw;
  }
  if (typeof raw === 'object' && raw !== null && 'val' in raw && typeof raw.val === 'string') {
    return raw.val;
  }
  return '';
}

function resolveTitle(rawSummary: unknown, fallbackTitle?: string): string {
  const extracted = extractSummary(rawSummary).trim();
  if (extracted.length > 0) {
    return extracted.slice(0, MAX_TITLE_LENGTH);
  }
  const fallback = fallbackTitle?.trim() || DEFAULT_FALLBACK_TITLE;
  return fallback.slice(0, MAX_TITLE_LENGTH);
}

function resolveUid(instance: EventInstance, fallbackEvent: VEvent): string {
  const instanceUid = typeof instance.event?.uid === 'string' ? instance.event.uid.trim() : '';
  if (instanceUid.length > 0) {
    return instanceUid;
  }
  const fallbackUid = typeof fallbackEvent.uid === 'string' ? fallbackEvent.uid.trim() : '';
  if (fallbackUid.length > 0) {
    return fallbackUid;
  }
  return randomUUID();
}

function normalizeAllDayEvent(instance: EventInstance): { startsAt: string; endsAt: string } {
  const startUtc = new Date(
    Date.UTC(
      instance.start.getFullYear(),
      instance.start.getMonth(),
      instance.start.getDate(),
      0,
      0,
      0,
      0
    )
  );

  let endUtc: Date;
  if (instance.end && !Number.isNaN(instance.end.getTime())) {
    endUtc = new Date(
      Date.UTC(
        instance.end.getFullYear(),
        instance.end.getMonth(),
        instance.end.getDate(),
        0,
        0,
        0,
        0
      )
    );
  } else {
    endUtc = new Date(startUtc.getTime() + MS_PER_DAY);
  }

  if (endUtc.getTime() <= startUtc.getTime()) {
    endUtc = new Date(startUtc.getTime() + MS_PER_DAY);
  }

  return {
    startsAt: startUtc.toISOString(),
    endsAt: endUtc.toISOString(),
  };
}

function normalizeTimedEvent(instance: EventInstance): { startsAt: string; endsAt: string } {
  const start = new Date(instance.start.getTime());
  let end =
    instance.end && !Number.isNaN(instance.end.getTime())
      ? new Date(instance.end.getTime())
      : new Date(start.getTime() + DEFAULT_MINIMUM_DURATION_MS);

  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + DEFAULT_MINIMUM_DURATION_MS);
  }

  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}

function normalizeInstance(
  instance: EventInstance,
  fallbackEvent: VEvent,
  options: ParseIcalOptions
): ExternalEventPayload | null {
  if (!instance.start || Number.isNaN(instance.start.getTime())) {
    return null;
  }

  const { startsAt, endsAt } = instance.isFullDay
    ? normalizeAllDayEvent(instance)
    : normalizeTimedEvent(instance);

  const title = resolveTitle(instance.summary, options.fallbackTitle);
  const uid = resolveUid(instance, fallbackEvent);

  return {
    uid,
    starts_at: startsAt,
    ends_at: endsAt,
    title,
  };
}

function expandEventInstances(
  component: VEvent,
  options: ParseIcalOptions
): readonly EventInstance[] {
  try {
    const raw = ical.expandRecurringEvent(component, {
      from: options.rangeStart,
      to: options.rangeEnd,
      includeOverrides: true,
      excludeExdates: true,
      expandOngoing: true,
    });
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function isVEvent(component: unknown): component is VEvent {
  return (
    typeof component === 'object' &&
    component !== null &&
    'type' in component &&
    component.type === 'VEVENT'
  );
}

function isValidRange(options: ParseIcalOptions): boolean {
  if (!(options.rangeStart instanceof Date) || !(options.rangeEnd instanceof Date)) {
    return false;
  }
  const startTime = options.rangeStart.getTime();
  const endTime = options.rangeEnd.getTime();
  return !Number.isNaN(startTime) && !Number.isNaN(endTime) && startTime <= endTime;
}

function parseIcsSafe(icsText: string): CalendarResponse | null {
  if (!icsText || !icsText.trim()) {
    return null;
  }
  try {
    return ical.sync.parseICS(icsText);
  } catch {
    return null;
  }
}

function collectComponentInstances(
  component: VEvent,
  options: ParseIcalOptions,
  seenKeys: Set<string>,
  results: ExternalEventPayload[]
): void {
  const instances = expandEventInstances(component, options);
  for (const instance of instances) {
    if (results.length >= MAX_EXTERNAL_EVENTS_PER_SUBSCRIPTION) {
      return;
    }

    const payload = normalizeInstance(instance, component, options);
    if (!payload) {
      continue;
    }

    const dedupeKey = `${payload.uid}|${payload.starts_at}`;
    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    seenKeys.add(dedupeKey);
    results.push(payload);
  }
}

/**
 * Pure function parsing and expanding iCal feeds into a flat array of external events.
 * Guarantees time order (ends_at > starts_at), UTC normalization for all-day events,
 * deduplication by (uid, starts_at), title trimming/length limit, and DoS capping.
 */
export function parseAndExpandIcal(
  icsText: string,
  options: ParseIcalOptions
): ExternalEventPayload[] {
  if (!isValidRange(options)) {
    return [];
  }

  const parsed = parseIcsSafe(icsText);
  if (!parsed) {
    return [];
  }

  const results: ExternalEventPayload[] = [];
  const seenKeys = new Set<string>();

  for (const component of Object.values(parsed)) {
    if (results.length >= MAX_EXTERNAL_EVENTS_PER_SUBSCRIPTION) {
      break;
    }

    if (isVEvent(component)) {
      collectComponentInstances(component, options, seenKeys, results);
    }
  }

  results.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return results;
}
