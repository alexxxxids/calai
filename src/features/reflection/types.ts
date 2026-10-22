import type { Database } from '@/types/database.types';
import type { ReflectionLevel } from '@/types/db';
import type { DisplayTypeStat } from './rules';

export type WeeklyReflectionRow = Database['public']['Tables']['weekly_reflections']['Row'];
export type MonthlyReflectionRow = Database['public']['Tables']['monthly_reflections']['Row'];

export interface ReflectionProfile {
  readonly id: string;
  readonly displayName: string | null;
  readonly timezone: string;
  readonly reflectionLevel: ReflectionLevel;
}

export interface WeeklyReflectionState {
  readonly currentWeek: string;
  readonly previousWeek: string;
  readonly currentReflection: WeeklyReflectionRow | null;
  readonly previousReflection: WeeklyReflectionRow | null;
}

export interface MonthlyReflectionState {
  readonly currentMonth: string;
  readonly previousMonth: string;
  readonly currentReflection: MonthlyReflectionRow | null;
  readonly previousReflection: MonthlyReflectionRow | null;
  readonly currentStats: readonly DisplayTypeStat[];
  readonly previousStats: readonly DisplayTypeStat[];
}

export interface ReflectionState {
  readonly profile: ReflectionProfile;
  readonly weekly: WeeklyReflectionState | null;
  readonly monthly: MonthlyReflectionState | null;
}
