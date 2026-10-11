import type { Tables } from '@/types/db';
import type {
  CreateRecurringEventInput,
  CreateRecurringEventsInput,
  DeleteRecurringEventInput,
} from './schemas';

export type {
  CreateRecurringEventInput,
  CreateRecurringEventsInput,
  DeleteRecurringEventInput,
};

export type RecurringEventRow = Tables<'recurring_events'>;

export interface RecurringEventItem {
  readonly id: string;
  readonly userId: string;
  readonly typeId: string;
  readonly title: string;
  readonly weekday: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly validFrom: string;
  readonly validUntil: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly typeName?: string;
  readonly typeColor?: string;
}

export interface RecurringEventTypeRelation {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly energy: number;
}

export interface RecurringEventWithRelations {
  readonly id: string;
  readonly title: string;
  readonly type_id: string;
  readonly weekday: number;
  readonly start_time: string;
  readonly end_time: string;
  readonly valid_from: string;
  readonly valid_until: string | null;
  readonly task_types: RecurringEventTypeRelation | null;
}
