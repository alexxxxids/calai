import type { BlockSource, BlockStatus } from '@/types/db';

export type { BlockSource, BlockStatus };

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

export interface ScheduleBlockResult {
  readonly blockId: string;
  readonly warning?: string;
}

export interface MoveBlockResult {
  readonly blockId: string;
  readonly warning?: string;
}
