import type {
  PlannerInput,
  UnscheduledReason,
  UnscheduledWork,
} from '@/domain/types';
import type {
  BlockSource,
  BlockStatus,
  ReflectionLevel,
  TaskFixation,
  TaskStatus,
} from '@/types/db';

export interface PlannerProfile {
  readonly id: string;
  readonly timezone: string;
  readonly day_start: string;
  readonly day_end: string;
  readonly daily_energy_limit: number;
  readonly reflection_level: ReflectionLevel;
}

export interface PlannerTaskType {
  readonly id: string;
  readonly name: string;
  readonly energy: number;
  readonly is_rest: boolean;
  readonly is_one_off: boolean;
}

export interface PlannerTaskRow {
  readonly id: string;
  readonly type_id: string;
  readonly notes: string | null;
  readonly priority: number;
  readonly fixation: TaskFixation;
  readonly estimate_minutes: number | null;
  readonly session_minutes: number | null;
  readonly deadline: string | null;
  readonly created_at: string;
  readonly status: TaskStatus;
}

export interface PlannerBlockRow {
  readonly id: string;
  readonly task_id: string | null;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly work_minutes: number;
  readonly status: BlockStatus;
  readonly source: BlockSource;
  readonly pinned: boolean;
  readonly actual_minutes: number | null;
  readonly closed_at: string | null;
}

export interface PlannerRecurringRow {
  readonly id: string;
  readonly type_id: string;
  readonly weekday: number;
  readonly start_time: string;
  readonly end_time: string;
  readonly valid_from: string;
  readonly valid_until: string | null;
}

export interface PlannerSubscriptionRow {
  readonly id: string;
  readonly type_id: string;
}

export interface PlannerExternalEventRow {
  readonly id: string;
  readonly subscription_id: string;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly title: string;
}

export interface PlannerReflectionRow {
  readonly week_start: string;
  readonly fatigue: number;
  readonly stress: number;
  readonly focus: number;
  readonly distractions: number;
}

export interface PlannerData {
  readonly profile: PlannerProfile;
  readonly taskTypes: readonly PlannerTaskType[];
  readonly tasks: readonly PlannerTaskRow[];
  readonly blocks: readonly PlannerBlockRow[];
  readonly recurringEvents: readonly PlannerRecurringRow[];
  readonly subscriptions: readonly PlannerSubscriptionRow[];
  readonly externalEvents: readonly PlannerExternalEventRow[];
  readonly latestReflection: PlannerReflectionRow | null;
}

export interface ReplanResult {
  readonly placed: number;
  readonly unscheduled: readonly UnscheduledWork[];
}

export interface UnscheduledItem {
  readonly taskId: string;
  readonly taskTitle: string;
  readonly missingMinutes: number;
  readonly reason: UnscheduledReason;
}

export interface RunPlannerResult {
  readonly placed: number;
  readonly unscheduled: readonly UnscheduledItem[];
}

export interface BuildInputResult {
  readonly input: PlannerInput;
  readonly removeBlockIds: readonly string[];
}
