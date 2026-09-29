import type { Database } from '@/types/database.types';

export type BlockSource = Database['public']['Enums']['block_source'];
export type BlockStatus = Database['public']['Enums']['block_status'];

export interface ScheduleBlockInput {
  readonly taskId: string;
  readonly start: string;
  readonly durationMinutes: number;
}

export interface MoveBlockInput {
  readonly blockId: string;
  readonly start: string;
  readonly end: string;
}

export interface CloseBlockInput {
  readonly blockId: string;
  readonly status: 'done' | 'missed';
  readonly actualMinutes?: number | null;
}

export interface DeleteBlockInput {
  readonly blockId: string;
}

export interface BlockItem {
  readonly id: string;
  readonly userId: string;
  readonly taskId: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly workMinutes: number;
  readonly status: BlockStatus;
  readonly source: BlockSource;
  readonly pinned: boolean;
  readonly actualMinutes: number | null;
  readonly closedAt: string | null;
  readonly notifiedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UnclosedBlockItem {
  readonly id: string;
  readonly taskId: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly workMinutes: number;
  readonly typeName: string;
  readonly typeColor: string;
  readonly typeEnergy: number;
  readonly notes: string | null;
}

export interface WarningLoadResult {
  readonly hasWarning: boolean;
  readonly warning?: string;
  readonly totalDayPoints?: number;
  readonly effectiveLimit?: number;
}

export interface ScheduleBlockResult {
  readonly blockId: string;
  readonly warning?: string;
}

export interface MoveBlockResult {
  readonly blockId: string;
  readonly warning?: string;
}
