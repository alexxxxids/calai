import type { BlockSource, BlockStatus, TaskFixation } from '@/types/db';

export type CalendarItemKind = 'block' | 'recurring' | 'external';

export interface CalendarEventExtendedProps {
  readonly kind: CalendarItemKind;
  readonly status: 'planned' | 'done' | 'missed' | null;
  readonly pinned: boolean;
  readonly taskId: string | null;
  readonly energy: number;
  readonly typeId: string | null;
}

export interface CalendarEventItem {
  readonly id: string;
  readonly title: string;
  readonly start: string;
  readonly end: string;
  readonly color: string;
  readonly editable: boolean;
  readonly extendedProps: CalendarEventExtendedProps;
}

export interface CalendarRange {
  readonly start: string;
  readonly end: string;
}

export interface TaskTypeItem {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly energy: number;
  readonly is_rest?: boolean;
}

export interface RawBlockWithRelations {
  readonly id: string;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly status: BlockStatus;
  readonly pinned: boolean;
  readonly source: BlockSource;
  readonly task_id: string | null;
  readonly tasks?: {
    readonly id: string;
    readonly fixation: TaskFixation;
    readonly type_id: string;
    readonly task_types: TaskTypeItem | null;
  } | null;
}

export interface RawRecurringWithRelations {
  readonly id: string;
  readonly title: string;
  readonly weekday: number;
  readonly start_time: string;
  readonly end_time: string;
  readonly valid_from: string;
  readonly valid_until: string | null;
  readonly type_id: string;
  readonly task_types?: TaskTypeItem | null;
}

export interface RawExternalWithRelations {
  readonly id: string;
  readonly title: string;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly calendar_subscriptions?: {
    readonly id: string;
    readonly type_id: string;
    readonly task_types?: TaskTypeItem | null;
  } | null;
}
