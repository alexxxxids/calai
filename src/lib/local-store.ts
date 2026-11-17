import { MS_PER_MINUTE } from '@/domain/constants';
import { zonedToInstant } from '@/domain/time';
import type {
  CloseBlockInput,
  DeleteBlockInput,
  MoveBlockInput,
  ScheduleBlockInput,
  ScheduleBlockResult,
  UnclosedBlockItem,
} from '@/features/blocks/types';
import {
  expandRecurringToCalendarEvents,
  mapBlockToCalendarEvent,
} from '@/features/calendar/event-mappers';
import type { CalendarEventItem, RawBlockWithRelations, TaskTypeItem } from '@/features/calendar/types';
import type {
  CreateRecurringEventsInput,
  DeleteRecurringEventInput,
  RecurringEventWithRelations,
} from '@/features/recurring-events/types';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { createSeedState, DEFAULT_TIMEZONE } from './local-store-seed';
import type { CalendarSnapshot, HabitForDay, LocalBlock, LocalStoreState } from './local-store-types';

const STORAGE_KEY = 'calai-local-calendar-v1';
const STORE_EVENT = 'calai-local-store-change';
const DEFAULT_DURATION_MIN = 90;
const FALLBACK_COLOR = '#3b82f6';
const HH_MM_LEN = 5;
const RANDOM_ID_MULT = 10000;
const DAYS_IN_WEEK = 7;

let storeVersion = 0;

export function newLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * RANDOM_ID_MULT)}`;
}

export function subscribeLocalStore(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const handler = () => callback();
  window.addEventListener('storage', handler);
  window.addEventListener(STORE_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(STORE_EVENT, handler);
  };
}

export function getLocalStoreVersion(): number {
  return storeVersion;
}

export function readLocalStore(): LocalStoreState {
  if (typeof window === 'undefined') {
    return createSeedState(DEFAULT_TIMEZONE);
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeedState(DEFAULT_TIMEZONE);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as LocalStoreState;
  } catch {
    const seed = createSeedState(DEFAULT_TIMEZONE);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
}

export function writeLocalStore(state: LocalStoreState): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  storeVersion += 1;
  window.dispatchEvent(new Event(STORE_EVENT));
}

export function resetLocalDemoStore(): LocalStoreState {
  const seed = createSeedState(DEFAULT_TIMEZONE);
  writeLocalStore(seed);
  return seed;
}

function buildUnclosedBlocks(state: LocalStoreState): readonly UnclosedBlockItem[] {
  const nowMs = Date.now();
  const typeMap = new Map(state.taskTypes.map((t) => [t.id, t]));
  return state.blocks
    .filter((b) => b.status === 'planned' && Date.parse(b.endsAt) <= nowMs)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .map((b) => {
      const tt = typeMap.get(b.typeId);
      return {
        id: b.id,
        taskId: b.taskId,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        workMinutes: b.workMinutes,
        typeName: tt?.name ?? b.title,
        typeColor: tt?.color ?? FALLBACK_COLOR,
        typeEnergy: tt?.energy ?? 1,
        notes: b.notes,
      };
    });
}

export function getCalendarSnapshot(): CalendarSnapshot {
  const state = readLocalStore();
  return {
    taskTypes: state.taskTypes,
    tasks: state.tasks,
    unclosedBlocks: buildUnclosedBlocks(state),
    recurringEvents: state.recurringEvents,
  };
}

function toRawBlock(block: LocalBlock, typeMap: ReadonlyMap<string, TaskTypeItem>): RawBlockWithRelations {
  const tt = typeMap.get(block.typeId) ?? null;
  return {
    id: block.id,
    starts_at: block.startsAt,
    ends_at: block.endsAt,
    status: block.status,
    pinned: block.pinned,
    source: block.source,
    task_id: block.taskId,
    tasks: {
      id: block.taskId ?? block.id,
      fixation: block.pinned ? 'hard' : 'flexible',
      type_id: block.typeId,
      task_types: tt,
    },
  };
}

export function getCalendarEventsInRange(
  startIso: string,
  endIso: string,
  timeZone = DEFAULT_TIMEZONE,
): CalendarEventItem[] {
  const state = readLocalStore();
  const rangeStart = Date.parse(startIso);
  const rangeEnd = Date.parse(endIso);
  const typeMap = new Map<string, TaskTypeItem>(
    state.taskTypes.map((t) => [
      t.id,
      { id: t.id, name: t.name, color: t.color, energy: t.energy, is_rest: t.is_rest },
    ]),
  );

  const blockEvents = state.blocks
    .filter((b) => Date.parse(b.endsAt) > rangeStart && Date.parse(b.startsAt) < rangeEnd)
    .map((b) => mapBlockToCalendarEvent(toRawBlock(b, typeMap)));

  const recEvents = state.recurringEvents.flatMap((rec) =>
    expandRecurringToCalendarEvents(rec, { start: startIso, end: endIso }, timeZone),
  );

  return [...blockEvents, ...recEvents];
}

export function localMoveBlock(input: MoveBlockInput): ActionResult<ScheduleBlockResult> {
  const state = readLocalStore();
  const target = state.blocks.find((b) => b.id === input.blockId);
  if (!target) {
    return fail('Nie znaleziono bloku');
  }
  const durationMin = Math.max(
    1,
    Math.round((Date.parse(input.end) - Date.parse(input.start)) / MS_PER_MINUTE),
  );
  const updated = state.blocks.map((b) =>
    b.id === input.blockId
      ? { ...b, startsAt: input.start, endsAt: input.end, workMinutes: durationMin }
      : b,
  );
  writeLocalStore({ ...state, blocks: updated });
  return ok({ blockId: input.blockId });
}

export function localScheduleTaskBlock(input: ScheduleBlockInput): ActionResult<ScheduleBlockResult> {
  const state = readLocalStore();
  const task = state.tasks.find((t) => t.id === input.taskId);
  if (!task) {
    return fail('Nie znaleziono zadania');
  }
  const duration = input.durationMinutes > 0 ? input.durationMinutes : DEFAULT_DURATION_MIN;
  const endIso = new Date(Date.parse(input.start) + duration * MS_PER_MINUTE).toISOString();
  const blockId = newLocalId('block');
  const newBlock: LocalBlock = {
    id: blockId,
    taskId: task.id,
    typeId: task.typeId,
    title: task.typeName,
    notes: task.notes,
    startsAt: input.start,
    endsAt: endIso,
    workMinutes: duration,
    status: 'planned',
    source: 'manual',
    pinned: false,
    actualMinutes: null,
  };
  writeLocalStore({ ...state, blocks: [...state.blocks, newBlock] });
  return ok({ blockId });
}

export function localCloseBlock(input: CloseBlockInput): ActionResult<{ readonly blockId: string }> {
  const state = readLocalStore();
  const updated = state.blocks.map((b) =>
    b.id === input.blockId
      ? { ...b, status: input.status, actualMinutes: input.actualMinutes ?? null }
      : b,
  );
  writeLocalStore({ ...state, blocks: updated });
  return ok({ blockId: input.blockId });
}

export function localDeleteBlock(input: DeleteBlockInput): ActionResult<{ readonly blockId: string }> {
  const state = readLocalStore();
  writeLocalStore({ ...state, blocks: state.blocks.filter((b) => b.id !== input.blockId) });
  return ok({ blockId: input.blockId });
}

export function localCreateRecurringEvents(
  input: CreateRecurringEventsInput,
): ActionResult<{ readonly created: number }> {
  const state = readLocalStore();
  const typeMap = new Map(state.taskTypes.map((t) => [t.id, t]));
  const additions: RecurringEventWithRelations[] = input.events.map((ev) => {
    const tt = typeMap.get(ev.typeId);
    return {
      id: newLocalId('rec'),
      title: ev.title,
      type_id: ev.typeId,
      weekday: ev.weekday,
      start_time: ev.startTime.length === HH_MM_LEN ? `${ev.startTime}:00` : ev.startTime,
      end_time: ev.endTime.length === HH_MM_LEN ? `${ev.endTime}:00` : ev.endTime,
      valid_from: ev.validFrom,
      valid_until: ev.validUntil ?? null,
      task_types: tt ? { id: tt.id, name: tt.name, color: tt.color, energy: tt.energy } : null,
    };
  });
  writeLocalStore({ ...state, recurringEvents: [...state.recurringEvents, ...additions] });
  return ok({ created: additions.length });
}

export function localDeleteRecurringEvent(
  input: DeleteRecurringEventInput,
): ActionResult<{ readonly id: string }> {
  const state = readLocalStore();
  writeLocalStore({
    ...state,
    recurringEvents: state.recurringEvents.filter((r) => r.id !== input.id),
  });
  return ok({ id: input.id });
}

export function localListHabitsForDay(day: string): HabitForDay[] {
  const state = readLocalStore();
  const jsDay = new Date(`${day}T12:00:00Z`).getUTCDay();
  const isoDay = jsDay === 0 ? DAYS_IN_WEEK : jsDay;
  return state.habits
    .filter((h) => h.weekdays.includes(isoDay))
    .map((h) => ({
      id: h.id,
      name: h.name,
      done: h.completedDays.includes(day),
      streak: h.completedDays.length,
    }));
}

export function localToggleHabit(habitId: string, day: string, done: boolean): HabitForDay[] {
  const state = readLocalStore();
  const updated = state.habits.map((h) => {
    if (h.id !== habitId) {
      return h;
    }
    const set = new Set(h.completedDays);
    if (done) {
      set.add(day);
    } else {
      set.delete(day);
    }
    return { ...h, completedDays: Array.from(set).sort() };
  });
  writeLocalStore({ ...state, habits: updated });
  return localListHabitsForDay(day);
}

export function resolveIsoInZone(date: string, time: string, timeZone: string): string {
  return new Date(zonedToInstant(date, time, timeZone)).toISOString();
}
