export const STATS_RANGE_7_DAYS = 7;
export const STATS_RANGE_30_DAYS = 30;
export const STATS_RANGE_90_DAYS = 90;
export const DEFAULT_STATS_RANGE = STATS_RANGE_30_DAYS;

export const MINUTES_PER_HOUR = 60;
export const MS_PER_MINUTE = 60_000;
export const MAX_FATIGUE_WEEKS_LIMIT = 12;
export const DEFAULT_BLOCK_ENERGY = 0;
export const PERCENTAGE_FACTOR = 100;
export const DAYS_OFFSET_ONE = 1;

export const DEFAULT_ONE_OFF_COLOR = '#888888';
export const ONE_OFF_AGGREGATE_ID = 'one-off-aggregate';
export const ONE_OFF_AGGREGATE_NAME = 'Jednorazowe';

export type StatsRange = 7 | 30 | 90;

export interface TypeStatsRow {
  readonly type_id: string;
  readonly type_name: string;
  readonly color: string;
  readonly is_one_off: boolean;
  readonly planned_minutes: number;
  readonly actual_minutes: number;
  readonly done_blocks: number;
  readonly missed_blocks: number;
}

export interface TypeStatItem {
  readonly typeId: string;
  readonly typeName: string;
  readonly color: string;
  readonly isOneOff: boolean;
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly doneBlocks: number;
  readonly missedBlocks: number;
  readonly completionRate: number; // 0..100
}

export interface RawBlockWithEnergy {
  readonly starts_at: string;
  readonly ends_at: string;
  readonly status: 'planned' | 'done' | 'missed';
  readonly actual_minutes: number | null;
  readonly energy: number;
}

export interface DailyLoadItem {
  readonly date: string; // 'YYYY-MM-DD'
  readonly points: number;
  readonly limit: number;
  readonly dayOfWeek: number; // 1..7 (ISO)
}

export interface FatigueTrendItem {
  readonly weekStart: string; // 'YYYY-MM-DD'
  readonly fatigue: number;
  readonly stress: number;
  readonly focus: number;
  readonly distractions: number;
}

export interface CompletionRateSummary {
  readonly totalDone: number;
  readonly totalMissed: number;
  readonly totalClosed: number;
  readonly percentage: number | null; // null if no closed blocks
}

export interface AggregateDailyLoadParams {
  readonly blocks: readonly RawBlockWithEnergy[];
  readonly rangeDays: StatsRange;
  readonly now: Date;
  readonly timeZone: string;
  readonly effectiveLimit: number;
}

export interface StatsDateRange {
  readonly fromLocalDate: string;
  readonly toLocalDate: string;
  readonly fromIso: string;
  readonly toIso: string;
}

export interface StatsOverview {
  readonly range: StatsRange;
  readonly typeStats: readonly TypeStatItem[];
  readonly dailyLoad: readonly DailyLoadItem[];
  readonly fatigueTrend: readonly FatigueTrendItem[];
  readonly completionRate: CompletionRateSummary;
  readonly effectiveLimit: number;
  readonly reflectionLevel: 'basic' | 'analytic' | 'strategic';
}
