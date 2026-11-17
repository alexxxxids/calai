import { expandWeekly } from '@/domain/recurrence';
import type { WeeklyRule } from '@/domain/recurrence';

const TIME_HH_MM_LENGTH = 5;

function toShortTime(time: string): string {
  return time.length >= TIME_HH_MM_LENGTH ? time.slice(0, TIME_HH_MM_LENGTH) : time;
}

import type {
  CalendarEventItem,
  CalendarRange,
  RawBlockWithRelations,
  RawExternalWithRelations,
  RawRecurringWithRelations,
  TaskTypeItem,
} from './types';

const REST_TITLE = 'Odpoczynek';
const DEFAULT_TASK_TITLE = 'Zadanie';
const DEFAULT_REST_COLOR = '#6b7280';
const DEFAULT_TASK_COLOR = '#3b82f6';
const DEFAULT_EXTERNAL_COLOR = '#64748b';
const DEFAULT_TASK_ENERGY = 1;
const DEFAULT_EXTERNAL_ENERGY = 0;
const REST_ENERGY = 0;

function resolveRestTypeProps(restType?: TaskTypeItem): {
  readonly color: string;
  readonly typeId: string | null;
} {
  if (!restType) {
    return { color: DEFAULT_REST_COLOR, typeId: null };
  }
  return { color: restType.color, typeId: restType.id };
}

function resolveTaskTypeProps(row: RawBlockWithRelations): {
  readonly title: string;
  readonly color: string;
  readonly energy: number;
  readonly typeId: string | null;
} {
  const taskType = row.tasks?.task_types;
  if (!taskType) {
    return {
      title: DEFAULT_TASK_TITLE,
      color: DEFAULT_TASK_COLOR,
      energy: DEFAULT_TASK_ENERGY,
      typeId: null,
    };
  }
  return {
    title: taskType.name,
    color: taskType.color,
    energy: taskType.energy,
    typeId: taskType.id,
  };
}

function isFlexiblePlanned(row: RawBlockWithRelations): boolean {
  return row.status === 'planned' && row.tasks?.fixation === 'flexible';
}

function mapRestBlock(
  row: RawBlockWithRelations,
  restType?: TaskTypeItem,
): CalendarEventItem {
  const { color, typeId } = resolveRestTypeProps(restType);
  return {
    id: row.id,
    title: REST_TITLE,
    start: row.starts_at,
    end: row.ends_at,
    color,
    editable: false,
    extendedProps: {
      kind: 'block',
      status: row.status,
      pinned: row.pinned,
      taskId: null,
      energy: REST_ENERGY,
      typeId,
    },
  };
}

function mapTaskBlock(row: RawBlockWithRelations): CalendarEventItem {
  const { title, color, energy, typeId } = resolveTaskTypeProps(row);
  return {
    id: row.id,
    title,
    start: row.starts_at,
    end: row.ends_at,
    color,
    editable: isFlexiblePlanned(row),
    extendedProps: {
      kind: 'block',
      status: row.status,
      pinned: row.pinned,
      taskId: row.task_id,
      energy,
      typeId,
    },
  };
}

export function mapBlockToCalendarEvent(
  row: RawBlockWithRelations,
  restType?: TaskTypeItem,
): CalendarEventItem {
  if (row.source === 'rest') {
    return mapRestBlock(row, restType);
  }
  return mapTaskBlock(row);
}

export function expandRecurringToCalendarEvents(
  item: RawRecurringWithRelations,
  range: CalendarRange,
  timezone: string,
): CalendarEventItem[] {
  const rule: WeeklyRule = {
    weekday: item.weekday,
    startTime: toShortTime(item.start_time),
    endTime: toShortTime(item.end_time),
    validFrom: item.valid_from,
    validUntil: item.valid_until,
  };

  const occurrences = expandWeekly(
    rule,
    { start: Date.parse(range.start), end: Date.parse(range.end) },
    timezone,
  );

  const color = item.task_types?.color ?? DEFAULT_TASK_COLOR;
  const energy = item.task_types?.energy ?? DEFAULT_TASK_ENERGY;

  return occurrences.map((occ) => {
    const startIso = new Date(occ.start).toISOString();
    const endIso = new Date(occ.end).toISOString();
    return {
      id: `${item.id}-${startIso}`,
      title: item.title,
      start: startIso,
      end: endIso,
      color,
      editable: false,
      extendedProps: {
        kind: 'recurring',
        status: null,
        pinned: false,
        taskId: null,
        energy,
        typeId: item.type_id,
      },
    };
  });
}

function resolveExternalTypeProps(row: RawExternalWithRelations): {
  readonly color: string;
  readonly energy: number;
  readonly typeId: string | null;
} {
  const sub = row.calendar_subscriptions;
  if (!sub) {
    return { color: DEFAULT_EXTERNAL_COLOR, energy: DEFAULT_EXTERNAL_ENERGY, typeId: null };
  }
  const taskType = sub.task_types;
  if (!taskType) {
    return { color: DEFAULT_EXTERNAL_COLOR, energy: DEFAULT_EXTERNAL_ENERGY, typeId: sub.type_id };
  }
  return { color: taskType.color, energy: taskType.energy, typeId: sub.type_id };
}

export function mapExternalToCalendarEvent(row: RawExternalWithRelations): CalendarEventItem {
  const { color, energy, typeId } = resolveExternalTypeProps(row);

  return {
    id: row.id,
    title: row.title,
    start: row.starts_at,
    end: row.ends_at,
    color,
    editable: false,
    extendedProps: {
      kind: 'external',
      status: null,
      pinned: false,
      taskId: null,
      energy,
      typeId,
    },
  };
}
