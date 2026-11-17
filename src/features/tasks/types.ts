import type { Priority } from '@/domain/types';

export interface BacklogTaskItem {
  readonly id: string;
  readonly typeId: string;
  readonly typeName: string;
  readonly typeColor: string;
  readonly typeEnergy: number;
  readonly isOneOff: boolean;
  readonly priority: Priority;
  readonly fixation: 'flexible' | 'hard';
  readonly notes: string | null;
  readonly estimateMinutes: number | null;
  readonly sessionMinutes: number | null;
  readonly deadline: string | null;
  readonly createdAt: string;
  readonly typePace: number;
}

export interface TaskWithDetails {
  readonly id: string;
  readonly userId: string;
  readonly typeId: string;
  readonly typeName: string;
  readonly typeColor: string;
  readonly typeEnergy: number;
  readonly isOneOff: boolean;
  readonly isRest: boolean;
  readonly priority: Priority;
  readonly fixation: 'flexible' | 'hard';
  readonly notes: string | null;
  readonly estimateMinutes: number | null;
  readonly sessionMinutes: number | null;
  readonly deadline: string | null;
  readonly status: 'active' | 'done' | 'cancelled';
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateTaskInput {
  readonly typeId?: string;
  readonly newOneOffTypeName?: string;
  readonly priority: Priority;
  readonly fixation: 'flexible' | 'hard';
  readonly notes?: string;
  readonly estimateMinutes?: number;
  readonly sessionMinutes?: number;
  readonly deadlineDate?: string;
  readonly deadlineTime?: string;
  readonly date?: string;
  readonly startTime?: string;
  readonly durationMinutes?: number;
  readonly timeZone: string;
}

export interface UpdateTaskInput {
  readonly taskId: string;
  readonly typeId?: string;
  readonly priority: Priority;
  readonly notes?: string;
  readonly estimateMinutes?: number | null;
  readonly sessionMinutes?: number | null;
  readonly deadlineDate?: string | null;
  readonly deadlineTime?: string | null;
  readonly timeZone: string;
}
