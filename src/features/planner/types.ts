import type { UnscheduledReason } from '@/domain/types';

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
