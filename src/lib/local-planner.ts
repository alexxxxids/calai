import { MS_PER_MINUTE } from '@/domain/constants';
import { addDaysToLocalDate, instantToLocalDate, zonedToInstant } from '@/domain/time';
import type { RunPlannerResult, UnscheduledItem } from '@/features/planner/types';
import { ok, type ActionResult } from '@/lib/action-result';
import { getCalendarEventsInRange, readLocalStore, writeLocalStore } from './local-store';
import { DEFAULT_TIMEZONE } from './local-store-seed';
import type { LocalBlock } from './local-store-types';

const HORIZON_DAYS = 7;
const SLOT_STEP_MINUTES = 15;
const SLOT_STEP_MS = SLOT_STEP_MINUTES * MS_PER_MINUTE;
const DEFAULT_BLOCK_MINUTES = 60;
const MAX_SESSION_MINUTES = 120;
const DAY_START_TIME = '08:00';
const DAY_END_TIME = '21:30';

interface BusySlot {
  readonly start: number;
  readonly end: number;
}

interface SearchWindow {
  readonly days: readonly string[];
  readonly minStartMs: number;
  readonly timeZone: string;
}

function collectBusySlots(rangeStartIso: string, rangeEndIso: string, timeZone: string): BusySlot[] {
  return getCalendarEventsInRange(rangeStartIso, rangeEndIso, timeZone).map((ev) => ({
    start: Date.parse(ev.start),
    end: Date.parse(ev.end),
  }));
}

function isFreeSlot(candidate: BusySlot, busy: readonly BusySlot[]): boolean {
  return !busy.some((b) => candidate.start < b.end && candidate.end > b.start);
}

function findNextFreeSlot(
  durationMs: number,
  busy: readonly BusySlot[],
  window: SearchWindow,
): BusySlot | null {
  for (const day of window.days) {
    const dayStart = zonedToInstant(day, DAY_START_TIME, window.timeZone);
    const dayEnd = zonedToInstant(day, DAY_END_TIME, window.timeZone);
    const startFrom = Math.max(dayStart, window.minStartMs);
    for (let cursor = startFrom; cursor + durationMs <= dayEnd; cursor += SLOT_STEP_MS) {
      const candidate = { start: cursor, end: cursor + durationMs };
      if (isFreeSlot(candidate, busy)) {
        return candidate;
      }
    }
  }
  return null;
}

export function localRunPlanner(timeZone = DEFAULT_TIMEZONE): ActionResult<RunPlannerResult> {
  const state = readLocalStore();
  const today = instantToLocalDate(Date.now(), timeZone);
  const days = Array.from({ length: HORIZON_DAYS }, (_, idx) => addDaysToLocalDate(today, idx));
  const rangeStartIso = new Date(zonedToInstant(days[0] ?? today, '00:00', timeZone)).toISOString();
  const rangeEndIso = new Date(zonedToInstant(days[days.length - 1] ?? today, '23:59', timeZone)).toISOString();

  const busy = collectBusySlots(rangeStartIso, rangeEndIso, timeZone);
  const scheduledTaskIds = new Set(
    state.blocks.filter((b) => b.status === 'planned' && b.taskId).map((b) => b.taskId as string),
  );
  const candidates = state.tasks
    .filter((t) => t.estimateMinutes !== null && !scheduledTaskIds.has(t.id))
    .sort((a, b) => a.priority - b.priority);

  const newBlocks: LocalBlock[] = [];
  const unscheduled: UnscheduledItem[] = [];
  const minStartMs = Math.ceil(Date.now() / SLOT_STEP_MS) * SLOT_STEP_MS;

  for (const task of candidates) {
    const minutes = Math.min(task.sessionMinutes ?? task.estimateMinutes ?? DEFAULT_BLOCK_MINUTES, MAX_SESSION_MINUTES);
    const currentBusy = [
      ...busy,
      ...newBlocks.map((b) => ({ start: Date.parse(b.startsAt), end: Date.parse(b.endsAt) })),
    ];
    const slot = findNextFreeSlot(minutes * MS_PER_MINUTE, currentBusy, { days, minStartMs, timeZone });
    if (!slot) {
      unscheduled.push({
        taskId: task.id,
        taskTitle: task.notes ? `${task.typeName}: ${task.notes}` : task.typeName,
        missingMinutes: minutes,
        reason: 'capacity',
      });
      continue;
    }
    newBlocks.push({
      id: `block-plan-${Date.now()}-${newBlocks.length}`,
      taskId: task.id,
      typeId: task.typeId,
      title: task.typeName,
      notes: task.notes,
      startsAt: new Date(slot.start).toISOString(),
      endsAt: new Date(slot.end).toISOString(),
      workMinutes: minutes,
      status: 'planned',
      source: 'planner',
      pinned: false,
      actualMinutes: null,
    });
  }

  writeLocalStore({ ...state, blocks: [...state.blocks, ...newBlocks] });
  return ok({ placed: newBlocks.length, unscheduled });
}
