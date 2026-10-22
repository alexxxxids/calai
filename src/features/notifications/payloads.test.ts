import { describe, expect, it } from 'vitest';
import {
  CALENDAR_ROUTE,
  DEFAULT_NOTIFICATION_ICON,
  REFLECTION_ROUTE,
  createCloseDayPayload,
  createUpcomingBlockPayload,
  createWeeklyReflectionPayload,
} from './payloads';

describe('notification payloads', () => {
  const WARSAW_TZ = 'Europe/Warsaw';

  it('creates upcoming block payload with type name and local time', () => {
    // 2026-10-12T08:00:00Z in Warsaw (UTC+2 in daylight saving) is 10:00
    const payload = createUpcomingBlockPayload({
      blockId: 'block-uuid-1',
      typeName: 'Matematyka',
      startsAt: '2026-10-12T08:00:00.000Z',
      timezone: WARSAW_TZ,
    });

    expect(payload.title).toBe('Nadchodzące: Matematyka');
    expect(payload.body).toContain('10:00');
    expect(payload.tag).toBe('block-block-uuid-1');
    expect(payload.icon).toBe(DEFAULT_NOTIFICATION_ICON);
    expect(payload.data?.url).toBe(CALENDAR_ROUTE);
  });

  it('creates close day payload with unclosed count and date tag', () => {
    const payload = createCloseDayPayload(3, '2026-10-12');

    expect(payload.title).toBe('Zamknij dzień');
    expect(payload.body).toContain('(3)');
    expect(payload.tag).toBe('close-day-2026-10-12');
    expect(payload.data?.url).toBe(CALENDAR_ROUTE);
  });

  it('creates weekly reflection payload with week tag', () => {
    const payload = createWeeklyReflectionPayload('2026-10-12');

    expect(payload.title).toBe('Cotygodniowa refleksja');
    expect(payload.body).toContain('Niedziela 19:00');
    expect(payload.tag).toBe('weekly-reflection-2026-10-12');
    expect(payload.data?.url).toBe(REFLECTION_ROUTE);
  });
});
