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

export type {
  CreateTaskInput,
  CreateTaskPayload,
  UpdateTaskInput,
  UpdateTaskPayload,
  CompleteTaskInput,
  CompleteTaskPayload,
  CancelTaskInput,
  CancelTaskPayload,
  PacePreview,
} from './schemas';
