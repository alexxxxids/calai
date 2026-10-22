import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FALLBACK_TITLE,
  DEFAULT_MINIMUM_DURATION_MS,
  MAX_EXTERNAL_EVENTS_PER_SUBSCRIPTION,
  MAX_TITLE_LENGTH,
  MS_PER_DAY,
  parseAndExpandIcal,
} from './parse-ical';

const TEST_RANGE = {
  rangeStart: new Date('2026-10-01T00:00:00.000Z'),
  rangeEnd: new Date('2026-10-31T23:59:59.999Z'),
};

describe('parseAndExpandIcal', () => {
  it('parses a standard single VEVENT with valid UID, times, and title', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CalAI Test//EN',
      'BEGIN:VEVENT',
      'UID:event-regular-1',
      'DTSTART:20261015T100000Z',
      'DTEND:20261015T113000Z',
      'SUMMARY:Konsultacje z fizyki',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      uid: 'event-regular-1',
      starts_at: '2026-10-15T10:00:00.000Z',
      ends_at: '2026-10-15T11:30:00.000Z',
      title: 'Konsultacje z fizyki',
    });
  });

  it('expands recurring events according to RRULE (weekly series)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:weekly-math-101',
      'DTSTART:20261001T080000Z',
      'DTEND:20261001T093000Z',
      'RRULE:FREQ=WEEKLY;UNTIL=20261031T235959Z',
      'SUMMARY:Matematyka dyskretna',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    // 2026-10-01, 2026-10-08, 2026-10-15, 2026-10-22, 2026-10-29 (5 Thursdays)
    expect(events).toHaveLength(5);
    for (const event of events) {
      expect(event.uid).toBe('weekly-math-101');
      expect(event.title).toBe('Matematyka dyskretna');
      expect(new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()).toBe(
        90 * 60 * 1000
      );
    }
    expect(events[0]?.starts_at).toBe('2026-10-01T08:00:00.000Z');
    expect(events[4]?.starts_at).toBe('2026-10-29T08:00:00.000Z');
  });

  it('normalizes all-day events strictly to midnight UTC (00:00:00.000Z)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:allday-event-1',
      'DTSTART;VALUE=DATE:20261025',
      'DTEND;VALUE=DATE:20261026',
      'SUMMARY:Dzień Nauczyciela',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]?.starts_at).toBe('2026-10-25T00:00:00.000Z');
    expect(events[0]?.ends_at).toBe('2026-10-26T00:00:00.000Z');
    expect(events[0]?.title).toBe('Dzień Nauczyciela');
  });

  it('normalizes multi-day all-day events across multiple days to UTC midnight', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:allday-multiday-1',
      'DTSTART;VALUE=DATE:20261010',
      'DTEND;VALUE=DATE:20261014',
      'SUMMARY:Warsztaty olimpijskie',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]?.starts_at).toBe('2026-10-10T00:00:00.000Z');
    expect(events[0]?.ends_at).toBe('2026-10-14T00:00:00.000Z');
  });

  it('handles all-day event without DTEND by adding MS_PER_DAY', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:allday-noend-1',
      'DTSTART;VALUE=DATE:20261018',
      'SUMMARY:Brak DTEND',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]?.starts_at).toBe('2026-10-18T00:00:00.000Z');
    expect(events[0]?.ends_at).toBe('2026-10-19T00:00:00.000Z');
  });

  it('enforces expandOngoing: true for events starting before rangeStart but ending within range', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:ongoing-event-1',
      'DTSTART:20260928T120000Z',
      'DTEND:20261005T120000Z',
      'SUMMARY:Zjazd integracyjny',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, {
      rangeStart: new Date('2026-10-01T00:00:00.000Z'),
      rangeEnd: new Date('2026-10-10T00:00:00.000Z'),
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.uid).toBe('ongoing-event-1');
    expect(events[0]?.starts_at).toBe('2026-09-28T12:00:00.000Z');
    expect(events[0]?.ends_at).toBe('2026-10-05T12:00:00.000Z');
  });

  it('enforces ends_at > starts_at for zero-duration events by adding DEFAULT_MINIMUM_DURATION_MS', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:zero-duration-1',
      'DTSTART:20261020T140000Z',
      'DTEND:20261020T140000Z',
      'SUMMARY:Przypomnienie o teście',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]?.starts_at).toBe('2026-10-20T14:00:00.000Z');
    expect(events[0]?.ends_at).toBe('2026-10-20T14:15:00.000Z');
    const duration =
      new Date(events[0]!.ends_at).getTime() - new Date(events[0]!.starts_at).getTime();
    expect(duration).toBe(DEFAULT_MINIMUM_DURATION_MS);
  });

  it('enforces ends_at > starts_at when DTEND is before DTSTART (corrupted times)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:reversed-time-1',
      'DTSTART:20261020T150000Z',
      'DTEND:20261020T140000Z',
      'SUMMARY:Błędny czas końcowy',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]?.starts_at).toBe('2026-10-20T15:00:00.000Z');
    expect(events[0]?.ends_at).toBe('2026-10-20T15:15:00.000Z');
    expect(new Date(events[0]!.ends_at).getTime()).toBeGreaterThan(
      new Date(events[0]!.starts_at).getTime()
    );
  });

  it('enforces ends_at > starts_at when timed event lacks DTEND', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:missing-end-1',
      'DTSTART:20261020T160000Z',
      'SUMMARY:Brak DTEND',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]?.starts_at).toBe('2026-10-20T16:00:00.000Z');
    expect(events[0]?.ends_at).toBe('2026-10-20T16:15:00.000Z');
  });

  it('enforces ends_at > starts_at when all-day event has end on or before start', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:allday-same-day-1',
      'DTSTART;VALUE=DATE:20261022',
      'DTEND;VALUE=DATE:20261022',
      'SUMMARY:Ten sam dzień',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]?.starts_at).toBe('2026-10-22T00:00:00.000Z');
    expect(events[0]?.ends_at).toBe('2026-10-23T00:00:00.000Z');
    const duration =
      new Date(events[0]!.ends_at).getTime() - new Date(events[0]!.starts_at).getTime();
    expect(duration).toBe(MS_PER_DAY);
  });

  it('skips events with invalid date (NaN) without crashing', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:broken-date-1',
      'DTSTART:INVALID_DATE',
      'SUMMARY:Zepsuta data',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:valid-event-2',
      'DTSTART:20261020T100000Z',
      'DTEND:20261020T110000Z',
      'SUMMARY:Poprawne wydarzenie',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]?.uid).toBe('valid-event-2');
    expect(events[0]?.title).toBe('Poprawne wydarzenie');
  });

  it('truncates summaries longer than MAX_TITLE_LENGTH (200 characters)', () => {
    const longSummary = 'A'.repeat(250);
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:long-title-1',
      'DTSTART:20261020T100000Z',
      'DTEND:20261020T110000Z',
      `SUMMARY:${longSummary}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]?.title).toHaveLength(MAX_TITLE_LENGTH);
    expect(events[0]?.title).toBe('A'.repeat(MAX_TITLE_LENGTH));
  });

  it('falls back to DEFAULT_FALLBACK_TITLE when summary is missing or only whitespace', () => {
    const icsMissing = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:no-summary-1',
      'DTSTART:20261020T100000Z',
      'DTEND:20261020T110000Z',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:whitespace-summary-2',
      'DTSTART:20261021T100000Z',
      'DTEND:20261021T110000Z',
      'SUMMARY:    ',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(icsMissing, TEST_RANGE);

    expect(events).toHaveLength(2);
    expect(events[0]?.title).toBe(DEFAULT_FALLBACK_TITLE);
    expect(events[1]?.title).toBe(DEFAULT_FALLBACK_TITLE);
  });

  it('uses custom fallbackTitle when provided for missing summaries', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:custom-fallback-1',
      'DTSTART:20261020T100000Z',
      'DTEND:20261020T110000Z',
      'SUMMARY:   ',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, {
      ...TEST_RANGE,
      fallbackTitle: 'Zajęcia z USOS',
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('Zajęcia z USOS');
  });

  it('extracts summary with parameters (ParameterValue object)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:param-summary-1',
      'DTSTART:20261020T100000Z',
      'DTEND:20261020T110000Z',
      'SUMMARY;LANGUAGE=pl:Projekt zespołowy CalAI',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('Projekt zespołowy CalAI');
  });

  it('generates a UUID when UID is missing in the VEVENT', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'DTSTART:20261020T100000Z',
      'DTEND:20261020T110000Z',
      'SUMMARY:Brak UID',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]?.uid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('deduplicates duplicate occurrences with identical (uid, starts_at)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:duplicate-uid-1',
      'DTSTART:20261020T100000Z',
      'DTEND:20261020T110000Z',
      'SUMMARY:Wpis pierwszy',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:duplicate-uid-1',
      'DTSTART:20261020T100000Z',
      'DTEND:20261020T110000Z',
      'SUMMARY:Wpis zdublowany',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]?.uid).toBe('duplicate-uid-1');
  });

  it('caps results at MAX_EXTERNAL_EVENTS_PER_SUBSCRIPTION (2500) against RRULE-bombs', () => {
    // Generate an hourly event spanning several months (> 3000 occurrences)
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:rrule-bomb-1',
      'DTSTART:20260101T000000Z',
      'DTEND:20260101T003000Z',
      'RRULE:FREQ=HOURLY;UNTIL=20261231T235959Z',
      'SUMMARY:Bomba godzinowa',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, {
      rangeStart: new Date('2026-01-01T00:00:00.000Z'),
      rangeEnd: new Date('2026-12-31T23:59:59.000Z'),
    });

    expect(events).toHaveLength(MAX_EXTERNAL_EVENTS_PER_SUBSCRIPTION);
    expect(events.length).toBe(2500);
    // Verified that all events remain sorted chronologically
    for (let index = 1; index < events.length; index += 1) {
      expect(events[index]!.starts_at >= events[index - 1]!.starts_at).toBe(true);
    }
  });

  it('returns empty array on empty string, whitespace-only, or non-ics text', () => {
    expect(parseAndExpandIcal('', TEST_RANGE)).toEqual([]);
    expect(parseAndExpandIcal('   ', TEST_RANGE)).toEqual([]);
    expect(parseAndExpandIcal('\n\t\r', TEST_RANGE)).toEqual([]);
    expect(parseAndExpandIcal('Zwykły tekst niebędący iCalem', TEST_RANGE)).toEqual([]);
    expect(parseAndExpandIcal('<html><body>404 Not Found</body></html>', TEST_RANGE)).toEqual([]);
  });

  it('returns empty array when date range is inverted or invalid', () => {
    const validIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:valid-1',
      'DTSTART:20261020T100000Z',
      'DTEND:20261020T110000Z',
      'SUMMARY:Test',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    // Inverted range
    expect(
      parseAndExpandIcal(validIcs, {
        rangeStart: new Date('2026-10-31T00:00:00.000Z'),
        rangeEnd: new Date('2026-10-01T00:00:00.000Z'),
      })
    ).toEqual([]);

    // Invalid dates (NaN)
    expect(
      parseAndExpandIcal(validIcs, {
        rangeStart: new Date('invalid'),
        rangeEnd: new Date('2026-10-31T00:00:00.000Z'),
      })
    ).toEqual([]);
  });

  it('ignores non-VEVENT components such as VTODO and VTIMEZONE', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Warsaw',
      'BEGIN:STANDARD',
      'DTSTART:19701025T030000',
      'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VTODO',
      'UID:todo-item-1',
      'DUE:20261020T180000Z',
      'SUMMARY:Oddać projekt',
      'END:VTODO',
      'BEGIN:VEVENT',
      'UID:actual-event-1',
      'DTSTART:20261020T120000Z',
      'DTEND:20261020T130000Z',
      'SUMMARY:Jedyny właściwy event',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(1);
    expect(events[0]?.uid).toBe('actual-event-1');
    expect(events[0]?.title).toBe('Jedyny właściwy event');
  });

  it('sorts multiple events out of chronological order by ascending starts_at', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:late-event',
      'DTSTART:20261028T100000Z',
      'DTEND:20261028T110000Z',
      'SUMMARY:Wydarzenie późne',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:early-event',
      'DTSTART:20261005T100000Z',
      'DTEND:20261005T110000Z',
      'SUMMARY:Wydarzenie wczesne',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:middle-event',
      'DTSTART:20261015T100000Z',
      'DTEND:20261015T110000Z',
      'SUMMARY:Wydarzenie środkowe',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseAndExpandIcal(ics, TEST_RANGE);

    expect(events).toHaveLength(3);
    expect(events[0]?.uid).toBe('early-event');
    expect(events[1]?.uid).toBe('middle-event');
    expect(events[2]?.uid).toBe('late-event');
  });
});
