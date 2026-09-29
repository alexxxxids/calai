import { RECOVERY_ENERGY } from '@/domain/constants';
import { expandWeekly, type WeeklyRule } from '@/domain/recurrence';
import type { BusyItem, Interval } from '@/domain/types';
import { postgresToTime } from '@/features/profile/schemas';

import type {
  PlannerBlockRow,
  PlannerExternalEventRow,
  PlannerRecurringRow,
  PlannerSubscriptionRow,
  PlannerTaskRow,
  PlannerTaskType,
} from './types';

const DEFAULT_TASK_ENERGY = 1;
const DEFAULT_EXTERNAL_ENERGY = 0;

export interface BusyTimeContext {
  readonly startOfToday: number;
  readonly nowMs: number;
  readonly startBufferMs: number;
}

export interface BusyAndRemovalsResult {
  readonly busy: readonly BusyItem[];
  readonly removeBlockIds: readonly string[];
}

function parseIso(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Nieprawidłowy znacznik czasu ISO: "${iso}"`);
  }
  return ms;
}

function isBlockFixed(
  block: PlannerBlockRow,
  startsAtMs: number,
  bufferCutoffMs: number,
  isHardTask: boolean
): boolean {
  if (block.pinned || isHardTask) {
    return true;
  }
  if (block.status === 'done' || block.status === 'missed') {
    return true;
  }
  return startsAtMs < bufferCutoffMs;
}

function isBlockRemovable(
  block: PlannerBlockRow,
  startsAtMs: number,
  bufferCutoffMs: number,
  isFlexible: boolean
): boolean {
  if (block.pinned || startsAtMs < bufferCutoffMs) {
    return false;
  }
  return block.source === 'rest' || (block.status === 'planned' && isFlexible);
}

function blockEnergy(
  block: PlannerBlockRow,
  task: PlannerTaskRow | undefined,
  typeMap: Map<string, PlannerTaskType>
): number {
  if (block.source === 'rest') {
    return RECOVERY_ENERGY;
  }
  const typeId = task ? task.type_id : '';
  const type = typeMap.get(typeId);
  return type ? type.energy : DEFAULT_TASK_ENERGY;
}

function buildBlockItems(
  blocks: readonly PlannerBlockRow[],
  taskMap: Map<string, PlannerTaskRow>,
  typeMap: Map<string, PlannerTaskType>,
  time: BusyTimeContext
): { readonly busyBlocks: BusyItem[]; readonly removeBlockIds: string[] } {
  const busyBlocks: BusyItem[] = [];
  const removeBlockIds: string[] = [];
  const bufferCutoffMs = time.nowMs + time.startBufferMs;

  for (const block of blocks) {
    const startsAtMs = parseIso(block.starts_at);
    const endsAtMs = parseIso(block.ends_at);
    if (endsAtMs <= startsAtMs) {
      continue;
    }

    const task = block.task_id ? taskMap.get(block.task_id) : undefined;
    const isHardTask = Boolean(task && task.fixation === 'hard');
    const isFlexible = Boolean(task && task.fixation === 'flexible');

    if (
      endsAtMs > time.startOfToday &&
      isBlockFixed(block, startsAtMs, bufferCutoffMs, isHardTask)
    ) {
      busyBlocks.push({
        interval: { start: startsAtMs, end: endsAtMs },
        energy: blockEnergy(block, task, typeMap),
        taskId: block.task_id,
      });
    }

    if (isBlockRemovable(block, startsAtMs, bufferCutoffMs, isFlexible)) {
      removeBlockIds.push(block.id);
    }
  }

  return { busyBlocks, removeBlockIds };
}

function expandRecurringItems(
  recurring: readonly PlannerRecurringRow[],
  typeMap: Map<string, PlannerTaskType>,
  range: Interval,
  timezone: string
): BusyItem[] {
  const busy: BusyItem[] = [];

  for (const item of recurring) {
    const rule: WeeklyRule = {
      weekday: item.weekday,
      startTime: postgresToTime(item.start_time),
      endTime: postgresToTime(item.end_time),
      validFrom: item.valid_from,
      validUntil: item.valid_until,
    };
    const energy = typeMap.get(item.type_id)?.energy ?? DEFAULT_TASK_ENERGY;
    const occurrences = expandWeekly(rule, range, timezone);
    for (const interval of occurrences) {
      busy.push({ interval, energy });
    }
  }

  return busy;
}

function buildExternalItems(
  external: readonly PlannerExternalEventRow[],
  subMap: Map<string, PlannerSubscriptionRow>,
  typeMap: Map<string, PlannerTaskType>,
  startOfToday: number
): BusyItem[] {
  const busy: BusyItem[] = [];

  for (const event of external) {
    const startsAtMs = parseIso(event.starts_at);
    const endsAtMs = parseIso(event.ends_at);
    if (endsAtMs <= startsAtMs || endsAtMs <= startOfToday) {
      continue;
    }
    const sub = subMap.get(event.subscription_id);
    const energy = typeMap.get(sub?.type_id ?? '')?.energy ?? DEFAULT_EXTERNAL_ENERGY;
    busy.push({
      interval: { start: startsAtMs, end: endsAtMs },
      energy,
    });
  }

  return busy;
}

export function buildBusyAndRemovals(
  data: {
    readonly blocks: readonly PlannerBlockRow[];
    readonly tasks: readonly PlannerTaskRow[];
    readonly taskTypes: readonly PlannerTaskType[];
    readonly recurringEvents: readonly PlannerRecurringRow[];
    readonly subscriptions: readonly PlannerSubscriptionRow[];
    readonly externalEvents: readonly PlannerExternalEventRow[];
  },
  time: BusyTimeContext,
  horizonEnd: number,
  timezone: string
): BusyAndRemovalsResult {
  const typeMap = new Map(data.taskTypes.map((type) => [type.id, type]));
  const taskMap = new Map(data.tasks.map((task) => [task.id, task]));
  const subMap = new Map(data.subscriptions.map((sub) => [sub.id, sub]));

  const { busyBlocks, removeBlockIds } = buildBlockItems(
    data.blocks,
    taskMap,
    typeMap,
    time
  );
  const recurringBusy = expandRecurringItems(
    data.recurringEvents,
    typeMap,
    { start: time.startOfToday, end: horizonEnd },
    timezone
  );
  const externalBusy = buildExternalItems(
    data.externalEvents,
    subMap,
    typeMap,
    time.startOfToday
  );

  const busy: BusyItem[] = [...busyBlocks, ...recurringBusy, ...externalBusy];
  busy.sort((a, b) => a.interval.start - b.interval.start || a.interval.end - b.interval.end);

  return { busy, removeBlockIds };
}
