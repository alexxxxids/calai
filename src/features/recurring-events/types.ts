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
