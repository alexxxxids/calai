import * as z from 'zod';
import {
  DEFAULT_STATS_RANGE,
  STATS_RANGE_7_DAYS,
  STATS_RANGE_30_DAYS,
  STATS_RANGE_90_DAYS,
  type StatsRange,
} from './types';

export const statsRangeSchema: z.ZodType<StatsRange> = z
  .union([
    z.literal(STATS_RANGE_7_DAYS),
    z.literal(STATS_RANGE_30_DAYS),
    z.literal(STATS_RANGE_90_DAYS),
    z.literal('7').transform((): StatsRange => STATS_RANGE_7_DAYS),
    z.literal('30').transform((): StatsRange => STATS_RANGE_30_DAYS),
    z.literal('90').transform((): StatsRange => STATS_RANGE_90_DAYS),
  ])
  .catch(DEFAULT_STATS_RANGE);

export function parseStatsRange(value: unknown): StatsRange {
  const result = statsRangeSchema.safeParse(value);
  return result.success ? result.data : DEFAULT_STATS_RANGE;
}
