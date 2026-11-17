export interface CreateRecurringEventItem {
  readonly title: string;
  readonly typeId: string;
  readonly weekday: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly validFrom: string;
  readonly validUntil?: string;
}

export interface CreateRecurringEventsInput {
  readonly events: readonly CreateRecurringEventItem[];
}

export interface DeleteRecurringEventInput {
  readonly id: string;
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
