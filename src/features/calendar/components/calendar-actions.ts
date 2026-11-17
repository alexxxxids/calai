import type {
  DropInfo,
  EventDropInfo,
  EventInput,
  EventResizeDoneInfo,
  EventSourceFuncInfo,
} from '@fullcalendar/react';
import { toast } from 'sonner';

import {
  getCalendarEventsInRange,
  localMoveBlock,
  localScheduleTaskBlock,
} from '@/lib/local-store';
import {
  calculateDropStartIso,
  parseDurationToMinutes,
  resolveDropInstants,
} from './calendar-helpers';

export interface CalendarActionContext {
  readonly workStart: string;
  readonly timeZone: string;
  readonly refetch: () => void;
  readonly onBlockUpdated?: () => void;
}

export async function fetchCalendarEvents(fetchInfo: EventSourceFuncInfo): Promise<EventInput[]> {
  return getCalendarEventsInRange(fetchInfo.startStr, fetchInfo.endStr);
}

export async function executeEventDrop(info: EventDropInfo, ctx: CalendarActionContext): Promise<void> {
  const { start, end } = resolveDropInstants({
    eventStart: info.event.start,
    eventEnd: info.event.end,
    eventStartStr: info.event.startStr,
    allDay: info.event.allDay,
    oldStart: info.oldEvent.start,
    oldEnd: info.oldEvent.end,
    workStart: ctx.workStart,
    timeZone: ctx.timeZone,
  });
  const result = localMoveBlock({ blockId: info.event.id, start, end });
  if (!result.ok) {
    info.revert();
    toast.error(result.error ?? 'Nie udało się przenieść bloku');
    return;
  }
  toast.success('Przeniesiono blok');
  ctx.refetch();
  ctx.onBlockUpdated?.();
}

export async function executeEventResize(info: EventResizeDoneInfo, ctx: CalendarActionContext): Promise<void> {
  if (!info.event.start || !info.event.end) {
    info.revert();
    return;
  }
  const result = localMoveBlock({
    blockId: info.event.id,
    start: info.event.start.toISOString(),
    end: info.event.end.toISOString(),
  });
  if (!result.ok) {
    info.revert();
    toast.error(result.error ?? 'Nie udało się zmienić czasu trwania bloku');
    return;
  }
  toast.success('Zmieniono czas trwania bloku');
  ctx.refetch();
  ctx.onBlockUpdated?.();
}

export async function executeExternalDrop(info: DropInfo, ctx: CalendarActionContext): Promise<void> {
  const taskId = info.draggedEl.getAttribute('data-task-id');
  if (!taskId) return;
  const durationStr = info.draggedEl.getAttribute('data-task-duration');
  const durationMinutes = parseDurationToMinutes(durationStr);
  const start = calculateDropStartIso(info.date, info.allDay, ctx.workStart, ctx.timeZone);

  const result = localScheduleTaskBlock({ taskId, start, durationMinutes });
  if (!result.ok) {
    toast.error(result.error ?? 'Nie udało się zaplanować zadania');
    return;
  }
  toast.success('Zaplanowano zadanie w kalendarzu');
  ctx.refetch();
  ctx.onBlockUpdated?.();
}
