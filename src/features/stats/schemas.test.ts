import { describe, expect, it } from 'vitest';
import { parseStatsRange, statsRangeSchema } from './schemas';
import {
  DEFAULT_STATS_RANGE,
  STATS_RANGE_7_DAYS,
  STATS_RANGE_30_DAYS,
  STATS_RANGE_90_DAYS,
} from './types';

describe('statsRangeSchema', () => {
  it('parses numeric values correctly', () => {
    expect(statsRangeSchema.parse(STATS_RANGE_7_DAYS)).toBe(STATS_RANGE_7_DAYS);
    expect(statsRangeSchema.parse(STATS_RANGE_30_DAYS)).toBe(STATS_RANGE_30_DAYS);
    expect(statsRangeSchema.parse(STATS_RANGE_90_DAYS)).toBe(STATS_RANGE_90_DAYS);
  });

  it('parses string representations and transforms them to numbers', () => {
    expect(statsRangeSchema.parse('7')).toBe(STATS_RANGE_7_DAYS);
    expect(statsRangeSchema.parse('30')).toBe(STATS_RANGE_30_DAYS);
    expect(statsRangeSchema.parse('90')).toBe(STATS_RANGE_90_DAYS);
  });

  it('falls back to default range on invalid inputs', () => {
    expect(statsRangeSchema.parse(undefined)).toBe(DEFAULT_STATS_RANGE);
    expect(statsRangeSchema.parse(null)).toBe(DEFAULT_STATS_RANGE);
    expect(statsRangeSchema.parse('invalid')).toBe(DEFAULT_STATS_RANGE);
    expect(statsRangeSchema.parse(15)).toBe(DEFAULT_STATS_RANGE);
  });

  it('parseStatsRange helper handles unknown values safely', () => {
    expect(parseStatsRange('7')).toBe(STATS_RANGE_7_DAYS);
    expect(parseStatsRange(null)).toBe(DEFAULT_STATS_RANGE);
    expect(parseStatsRange({ foo: 'bar' })).toBe(DEFAULT_STATS_RANGE);
  });
});
