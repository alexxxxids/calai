import { describe, expect, it } from 'vitest';
import {
  aggregateDailyLoadPoints,
  aggregateOneOffTypes,
  calculateCompletionRateSummary,
  calculateStatsDateRange,
  formatFatigueTrend,
  type WeeklyReflectionTrendRow,
} from './rules';
import {
  ONE_OFF_AGGREGATE_ID,
  ONE_OFF_AGGREGATE_NAME,
  STATS_RANGE_7_DAYS,
  STATS_RANGE_30_DAYS,
  STATS_RANGE_90_DAYS,
  type RawBlockWithEnergy,
  type TypeStatsRow,
} from './types';

const WARSAW_TZ = 'Europe/Warsaw';

describe('calculateStatsDateRange', () => {
  it('computes exact 7-day local interval and ISO boundaries', () => {
    // 2026-10-22 12:00 in Warsaw
    const now = new Date('2026-10-22T10:00:00Z');
    const range = calculateStatsDateRange(STATS_RANGE_7_DAYS, now, WARSAW_TZ);

    expect(range.toLocalDate).toBe('2026-10-22');
    expect(range.fromLocalDate).toBe('2026-10-16');
    expect(range.fromIso).toBe('2026-10-15T22:00:00.000Z');
    expect(range.toIso).toBe('2026-10-22T22:00:00.000Z');
  });

  it('computes 30-day and 90-day intervals', () => {
    const now = new Date('2026-10-22T10:00:00Z');
    const range30 = calculateStatsDateRange(STATS_RANGE_30_DAYS, now, WARSAW_TZ);
    expect(range30.toLocalDate).toBe('2026-10-22');
    expect(range30.fromLocalDate).toBe('2026-09-23');

    const range90 = calculateStatsDateRange(STATS_RANGE_90_DAYS, now, WARSAW_TZ);
    expect(range90.toLocalDate).toBe('2026-10-22');
    expect(range90.fromLocalDate).toBe('2026-07-25');
  });
});

describe('aggregateOneOffTypes', () => {
  const sampleRows: TypeStatsRow[] = [
    {
      type_id: 'regular-1',
      type_name: 'Nauka',
      color: '#ff0000',
      is_one_off: false,
      planned_minutes: 120,
      actual_minutes: 110,
      done_blocks: 2,
      missed_blocks: 0,
    },
    {
      type_id: 'oneoff-1',
      type_name: 'Projekt biologia',
      color: '#00ff00',
      is_one_off: true,
      planned_minutes: 60,
      actual_minutes: 70,
      done_blocks: 1,
      missed_blocks: 0,
    },
    {
      type_id: 'oneoff-2',
      type_name: 'Prezentacja historia',
      color: '#0000ff',
      is_one_off: true,
      planned_minutes: 30,
      actual_minutes: 0,
      done_blocks: 0,
      missed_blocks: 1,
    },
    {
      type_id: 'regular-2',
      type_name: 'Sport',
      color: '#ffff00',
      is_one_off: false,
      planned_minutes: 180,
      actual_minutes: 180,
      done_blocks: 3,
      missed_blocks: 1,
    },
  ];

  it('groups all one-off types under Jednorazowe aggregate item', () => {
    const result = aggregateOneOffTypes(sampleRows);
    const oneOffItem = result.find((item) => item.isOneOff);

    expect(oneOffItem).toBeDefined();
    expect(oneOffItem?.typeId).toBe(ONE_OFF_AGGREGATE_ID);
    expect(oneOffItem?.typeName).toBe(ONE_OFF_AGGREGATE_NAME);
    expect(oneOffItem?.plannedMinutes).toBe(90);
    expect(oneOffItem?.actualMinutes).toBe(70);
    expect(oneOffItem?.doneBlocks).toBe(1);
    expect(oneOffItem?.missedBlocks).toBe(1);
    expect(oneOffItem?.completionRate).toBe(50);
  });

  it('sorts regular types by plannedMinutes descending', () => {
    const result = aggregateOneOffTypes(sampleRows);
    const regularItems = result.filter((item) => !item.isOneOff);

    expect(regularItems).toHaveLength(2);
    expect(regularItems[0]?.typeName).toBe('Sport');
    expect(regularItems[0]?.plannedMinutes).toBe(180);
    expect(regularItems[0]?.completionRate).toBe(75);

    expect(regularItems[1]?.typeName).toBe('Nauka');
    expect(regularItems[1]?.plannedMinutes).toBe(120);
    expect(regularItems[1]?.completionRate).toBe(100);
  });

  it('handles empty rows cleanly', () => {
    expect(aggregateOneOffTypes([])).toEqual([]);
  });
});

describe('calculateCompletionRateSummary', () => {
  it('calculates total completion rate percentage', () => {
    const items = [
      {
        typeId: '1',
        typeName: 'A',
        color: '#fff',
        isOneOff: false,
        plannedMinutes: 60,
        actualMinutes: 60,
        doneBlocks: 8,
        missedBlocks: 2,
        completionRate: 80,
      },
      {
        typeId: '2',
        typeName: 'B',
        color: '#000',
        isOneOff: false,
        plannedMinutes: 30,
        actualMinutes: 30,
        doneBlocks: 2,
        missedBlocks: 0,
        completionRate: 100,
      },
    ];

    const summary = calculateCompletionRateSummary(items);
    expect(summary.totalDone).toBe(10);
    expect(summary.totalMissed).toBe(2);
    expect(summary.totalClosed).toBe(12);
    expect(summary.percentage).toBe(83);
  });

  it('returns percentage: null when there are no closed blocks', () => {
    const summary = calculateCompletionRateSummary([]);
    expect(summary.totalDone).toBe(0);
    expect(summary.totalMissed).toBe(0);
    expect(summary.totalClosed).toBe(0);
    expect(summary.percentage).toBeNull();
  });
});

describe('aggregateDailyLoadPoints', () => {
  it('generates full sequence of days without skipping empty days', () => {
    const now = new Date('2026-10-22T10:00:00Z');
    const result = aggregateDailyLoadPoints({
      blocks: [],
      rangeDays: STATS_RANGE_7_DAYS,
      now,
      timeZone: WARSAW_TZ,
      effectiveLimit: 20,
    });

    expect(result).toHaveLength(7);
    expect(result[0]?.date).toBe('2026-10-16');
    expect(result[6]?.date).toBe('2026-10-22');
    for (const item of result) {
      expect(item.points).toBe(0);
      expect(item.limit).toBe(20);
      expect(item.dayOfWeek).toBeGreaterThanOrEqual(1);
      expect(item.dayOfWeek).toBeLessThanOrEqual(7);
    }
  });

  it('calculates load points using actual_minutes when present and duration otherwise', () => {
    const now = new Date('2026-10-22T10:00:00Z');
    const blocks: RawBlockWithEnergy[] = [
      {
        starts_at: '2026-10-22T08:00:00Z',
        ends_at: '2026-10-22T09:00:00Z',
        status: 'planned',
        actual_minutes: null,
        energy: 2,
      },
      {
        starts_at: '2026-10-22T09:00:00Z',
        ends_at: '2026-10-22T10:00:00Z',
        status: 'done',
        actual_minutes: 90,
        energy: 3,
      },
    ];

    const result = aggregateDailyLoadPoints({
      blocks,
      rangeDays: STATS_RANGE_7_DAYS,
      now,
      timeZone: WARSAW_TZ,
      effectiveLimit: 20,
    });

    const todayItem = result.find((item) => item.date === '2026-10-22');
    expect(todayItem).toBeDefined();
    expect(todayItem?.points).toBe(6.5);
  });

  it('correctly aggregates across Warsaw DST autumn transition (2026-10-25)', () => {
    const now = new Date('2026-10-27T10:00:00Z');
    const blocks: RawBlockWithEnergy[] = [
      {
        starts_at: '2026-10-24T08:00:00Z',
        ends_at: '2026-10-24T09:00:00Z',
        status: 'done',
        actual_minutes: 60,
        energy: 2,
      },
      {
        starts_at: '2026-10-25T09:00:00Z',
        ends_at: '2026-10-25T11:00:00Z',
        status: 'done',
        actual_minutes: 120,
        energy: 3,
      },
      {
        starts_at: '2026-10-26T09:00:00Z',
        ends_at: '2026-10-26T10:00:00Z',
        status: 'done',
        actual_minutes: 60,
        energy: 1,
      },
    ];

    const result = aggregateDailyLoadPoints({
      blocks,
      rangeDays: STATS_RANGE_7_DAYS,
      now,
      timeZone: WARSAW_TZ,
      effectiveLimit: 20,
    });

    const day24 = result.find((item) => item.date === '2026-10-24');
    const day25 = result.find((item) => item.date === '2026-10-25');
    const day26 = result.find((item) => item.date === '2026-10-26');

    expect(day24?.points).toBe(2);
    expect(day25?.points).toBe(6);
    expect(day26?.points).toBe(1);
  });
});

describe('formatFatigueTrend', () => {
  it('sorts reflections ascending by week_start and extracts trend fields', () => {
    const reflections: WeeklyReflectionTrendRow[] = [
      {
        week_start: '2026-10-12',
        fatigue: 4,
        stress: 3,
        focus: 2,
        distractions: 4,
      },
      {
        week_start: '2026-09-28',
        fatigue: 2,
        stress: 2,
        focus: 4,
        distractions: 2,
      },
      {
        week_start: '2026-10-05',
        fatigue: 3,
        stress: 3,
        focus: 3,
        distractions: 3,
      },
    ];

    const trend = formatFatigueTrend(reflections);
    expect(trend).toHaveLength(3);
    expect(trend[0]?.weekStart).toBe('2026-09-28');
    expect(trend[1]?.weekStart).toBe('2026-10-05');
    expect(trend[2]?.weekStart).toBe('2026-10-12');
    expect(trend[2]?.fatigue).toBe(4);
    expect(trend[2]?.stress).toBe(3);
  });
});
