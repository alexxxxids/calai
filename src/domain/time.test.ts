import { afterEach, describe, expect, it } from 'vitest';

import {
  addDaysToLocalDate,
  instantToLocalDate,
  instantToLocalTime,
  isoWeekday,
  localDayRange,
  minutesToMs,
  weekStart,
  zonedToInstant,
} from '@/domain/time';

const WARSAW = 'Europe/Warsaw';
const HOUR_MS = 3_600_000;

describe('zonedToInstant', () => {
  it('should subtract two hours when the date is in Warsaw summer time', () => {
    // Arrange
    const date = '2026-10-05';

    // Act
    const instant = zonedToInstant(date, '08:00', WARSAW);

    // Assert
    expect(instant).toBe(Date.parse('2026-10-05T06:00:00.000Z'));
  });

  it('should subtract one hour when the date is in Warsaw winter time', () => {
    const instant = zonedToInstant('2026-11-03', '08:00', WARSAW);

    expect(instant).toBe(Date.parse('2026-11-03T07:00:00.000Z'));
  });

  it('should move a skipped time forward when clocks jump from 02:00 to 03:00', () => {
    // 2026-03-29: 02:00 CET becomes 03:00 CEST, so 02:30 does not exist and means 03:30.
    const instant = zonedToInstant('2026-03-29', '02:30', WARSAW);

    expect(instant).toBe(Date.parse('2026-03-29T01:30:00.000Z'));
    expect(instantToLocalTime(instant, WARSAW)).toBe('03:30');
  });

  it('should use summer time for a time after the spring clock change on the same day', () => {
    const instant = zonedToInstant('2026-03-29', '08:00', WARSAW);

    expect(instant).toBe(Date.parse('2026-03-29T06:00:00.000Z'));
  });

  it('should take the first occurrence when a time happens twice as clocks go back', () => {
    // 2026-10-25: 03:00 CEST becomes 02:00 CET, so 02:30 happens at 00:30Z and again at 01:30Z.
    const instant = zonedToInstant('2026-10-25', '02:30', WARSAW);

    expect(instant).toBe(Date.parse('2026-10-25T00:30:00.000Z'));
  });

  it('should use winter time for a time after the autumn clock change on the same day', () => {
    const instant = zonedToInstant('2026-10-25', '03:00', WARSAW);

    expect(instant).toBe(Date.parse('2026-10-25T02:00:00.000Z'));
  });

  it('should cross the year boundary when converting midnight of 1 January', () => {
    const instant = zonedToInstant('2027-01-01', '00:00', WARSAW);

    expect(instant).toBe(Date.parse('2026-12-31T23:00:00.000Z'));
  });

  it('should throw when the date does not exist', () => {
    expect(() => zonedToInstant('2026-02-30', '08:00', WARSAW)).toThrow(RangeError);
  });

  it('should throw when the date is not written as YYYY-MM-DD', () => {
    expect(() => zonedToInstant('2026-3-29', '08:00', WARSAW)).toThrow(RangeError);
  });

  it('should throw when the time is not a valid HH:mm', () => {
    expect(() => zonedToInstant('2026-10-05', '24:00', WARSAW)).toThrow(RangeError);
    expect(() => zonedToInstant('2026-10-05', '12:60', WARSAW)).toThrow(RangeError);
    expect(() => zonedToInstant('2026-10-05', '8:00', WARSAW)).toThrow(RangeError);
  });

  it('should throw when the time zone is unknown', () => {
    expect(() => zonedToInstant('2026-10-05', '08:00', 'Europe/Warsw')).toThrow(RangeError);
  });

  // The same two rules in other zones: a skipped time moves forward, a repeated time is taken first.
  it.each([
    // India: +05:30 all year, no clock changes.
    { zone: 'Asia/Kolkata', date: '2026-10-05', time: '08:00', expected: '2026-10-05T02:30:00Z' },
    // New York, 8 March 2026: 02:00 EST → 03:00 EDT, so 02:30 means 03:30 EDT (UTC−4).
    {
      zone: 'America/New_York',
      date: '2026-03-08',
      time: '02:30',
      expected: '2026-03-08T07:30:00Z',
    },
    // New York, 1 November 2026: 02:00 EDT → 01:00 EST, so 01:30 happens first in EDT (UTC−4).
    {
      zone: 'America/New_York',
      date: '2026-11-01',
      time: '01:30',
      expected: '2026-11-01T05:30:00Z',
    },
    // Sydney, 4 October 2026: 02:00 AEST → 03:00 AEDT, so 02:30 means 03:30 AEDT (UTC+11).
    {
      zone: 'Australia/Sydney',
      date: '2026-10-04',
      time: '02:30',
      expected: '2026-10-03T16:30:00Z',
    },
    // Sydney, 5 April 2026: 03:00 AEDT → 02:00 AEST, so 02:30 happens first in AEDT (UTC+11).
    {
      zone: 'Australia/Sydney',
      date: '2026-04-05',
      time: '02:30',
      expected: '2026-04-04T15:30:00Z',
    },
  ])('should give $expected for $date $time in $zone', ({ zone, date, time, expected }) => {
    expect(zonedToInstant(date, time, zone)).toBe(Date.parse(expected));
  });
});

describe('zonedToInstant on machines in different time zones', () => {
  const originalZone = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalZone;
  });

  // The server runs in UTC and the browser in the user's zone: both must get the same instants.
  const machines = [
    { zone: 'UTC', julyOffset: 0 },
    { zone: 'Europe/Warsaw', julyOffset: -120 },
    { zone: 'Europe/London', julyOffset: -60 },
    { zone: 'America/New_York', julyOffset: 240 },
    { zone: 'Asia/Tokyo', julyOffset: -540 },
  ];

  for (const machine of machines) {
    it(`should give the same instants around clock changes when the machine runs in ${machine.zone}`, () => {
      // Arrange: switch the zone of this test process, and prove that the switch worked.
      process.env.TZ = machine.zone;
      expect(new Date(Date.parse('2026-07-01T12:00:00Z')).getTimezoneOffset()).toBe(
        machine.julyOffset,
      );

      // Act
      const autumn = zonedToInstant('2026-10-25', '02:30', WARSAW);
      const spring = zonedToInstant('2026-03-29', '02:30', WARSAW);

      // Assert
      expect(autumn).toBe(Date.parse('2026-10-25T00:30:00.000Z'));
      expect(spring).toBe(Date.parse('2026-03-29T01:30:00.000Z'));
    });
  }
});

describe('instantToLocalDate', () => {
  it('should return the next date when the instant is just after local midnight', () => {
    expect(instantToLocalDate(Date.parse('2026-10-04T22:30:00Z'), WARSAW)).toBe('2026-10-05');
  });

  it('should return the same date when the instant is one minute before local midnight', () => {
    expect(instantToLocalDate(Date.parse('2026-10-04T21:59:00Z'), WARSAW)).toBe('2026-10-04');
  });

  it('should return the new year when the instant is just after local midnight of 1 January', () => {
    expect(instantToLocalDate(Date.parse('2026-12-31T23:30:00Z'), WARSAW)).toBe('2027-01-01');
  });

  it('should return the old year when the instant is just before local midnight of 1 January', () => {
    expect(instantToLocalDate(Date.parse('2026-12-31T22:59:00Z'), WARSAW)).toBe('2026-12-31');
  });

  it('should throw when the time zone is unknown', () => {
    expect(() => instantToLocalDate(0, 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('instantToLocalTime', () => {
  it('should show summer time when the instant is in October', () => {
    expect(instantToLocalTime(Date.parse('2026-10-05T06:00:00Z'), WARSAW)).toBe('08:00');
  });

  it('should show winter time when the instant is in November', () => {
    expect(instantToLocalTime(Date.parse('2026-11-03T07:00:00Z'), WARSAW)).toBe('08:00');
  });

  it('should show 02:30 twice when clocks go back', () => {
    expect(instantToLocalTime(Date.parse('2026-10-25T00:30:00Z'), WARSAW)).toBe('02:30');
    expect(instantToLocalTime(Date.parse('2026-10-25T01:30:00Z'), WARSAW)).toBe('02:30');
  });
});

describe('localDayRange', () => {
  it('should last 24 hours when the date has no clock change', () => {
    const day = localDayRange('2026-10-05', WARSAW);

    expect(day).toEqual({
      start: Date.parse('2026-10-04T22:00:00Z'),
      end: Date.parse('2026-10-05T22:00:00Z'),
    });
  });

  it('should last 23 hours when clocks go forward', () => {
    const day = localDayRange('2026-03-29', WARSAW);

    expect(day).toEqual({
      start: Date.parse('2026-03-28T23:00:00Z'),
      end: Date.parse('2026-03-29T22:00:00Z'),
    });
    expect(day.end - day.start).toBe(23 * HOUR_MS);
  });

  it('should last 25 hours when clocks go back', () => {
    const day = localDayRange('2026-10-25', WARSAW);

    expect(day).toEqual({
      start: Date.parse('2026-10-24T22:00:00Z'),
      end: Date.parse('2026-10-25T23:00:00Z'),
    });
    expect(day.end - day.start).toBe(25 * HOUR_MS);
  });
});

describe('addDaysToLocalDate', () => {
  it('should roll over to the next year when adding a day to 31 December', () => {
    expect(addDaysToLocalDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('should go back a month when subtracting a day from the first of the month', () => {
    expect(addDaysToLocalDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('should reach 29 February when the year is a leap year', () => {
    expect(addDaysToLocalDate('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('should step over a clock change like over any other day', () => {
    expect(addDaysToLocalDate('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDaysToLocalDate('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('should add many days across months', () => {
    expect(addDaysToLocalDate('2026-10-05', 60)).toBe('2026-12-04');
  });
});

describe('isoWeekday', () => {
  it('should return 1 when the date is a Monday', () => {
    expect(isoWeekday('2026-10-05')).toBe(1);
  });

  it('should return 7 when the date is a Sunday', () => {
    expect(isoWeekday('2026-10-11')).toBe(7);
  });

  it('should return 4 when the date is a Thursday', () => {
    expect(isoWeekday('2026-10-08')).toBe(4);
  });
});

describe('weekStart', () => {
  it('should return the Monday when the date is a Thursday', () => {
    expect(weekStart('2026-10-08')).toBe('2026-10-05');
  });

  it('should return the same date when the date is a Monday', () => {
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
  });

  it('should return the previous Monday when the date is a Sunday', () => {
    expect(weekStart('2026-10-11')).toBe('2026-10-05');
  });

  it('should return a Monday of the old year when the week crosses the year boundary', () => {
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
  });
});

describe('minutesToMs', () => {
  it('should convert minutes to milliseconds', () => {
    expect(minutesToMs(90)).toBe(5_400_000);
  });
});
