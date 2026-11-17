import type { UnclosedBlockItem } from '@/features/blocks/types';
import type { RecurringEventWithRelations } from '@/features/recurring-events/types';
import type { BacklogTaskItem } from '@/features/tasks/types';
import type { BlockSource, BlockStatus, TaskType } from '@/types/db';

export interface LocalBlock {
  readonly id: string;
  readonly taskId: string | null;
  readonly typeId: string;
  readonly title: string;
  readonly notes: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly workMinutes: number;
  readonly status: BlockStatus;
  readonly source: BlockSource;
  readonly pinned: boolean;
  readonly actualMinutes: number | null;
}

export interface LocalHabit {
  readonly id: string;
  readonly name: string;
  readonly weekdays: readonly number[];
  readonly completedDays: readonly string[];
}

export interface LocalStoreState {
  readonly taskTypes: readonly TaskType[];
  readonly tasks: readonly BacklogTaskItem[];
  readonly blocks: readonly LocalBlock[];
  readonly recurringEvents: readonly RecurringEventWithRelations[];
  readonly habits: readonly LocalHabit[];
}

export interface HabitForDay {
  readonly id: string;
  readonly name: string;
  readonly done: boolean;
  readonly streak: number;
}

export interface CalendarSnapshot {
  readonly taskTypes: readonly TaskType[];
  readonly tasks: readonly BacklogTaskItem[];
  readonly unclosedBlocks: readonly UnclosedBlockItem[];
  readonly recurringEvents: readonly RecurringEventWithRelations[];
}
