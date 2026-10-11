import type {
  DropInfo,
  EventDropInfo,
  EventInput,
  EventResizeDoneInfo,
  EventSourceFuncInfo,
} from '@fullcalendar/react';
import { toast } from 'sonner';

import { moveBlock, scheduleTaskBlock } from '@/features/blocks/actions';
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
  try {
    const startParam = encodeURIComponent(fetchInfo.startStr);
    const endParam = encodeURIComponent(fetchInfo.endStr);
    const response = await fetch(`/api/calendar?start=${startParam}&end=${endParam}`);
    if (!response.ok) {
      toast.error('Nie udało się pobrać wydarzeń z kalendarza');
      return [];
    }
    return (await response.json()) as EventInput[];
  } catch {
    toast.error('Błąd połączenia');
    return [];
  }
}

export async function executeEventDrop(info: EventDropInfo, ctx: CalendarActionContext): Promise<void> {
  try {
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
    const result = await moveBlock({ blockId: info.event.id, start, end });
    if (!result.ok) {
      info.revert();
      toast.error(result.error ?? 'Nie udało się przenieść bloku');
      return;
    }
    if (result.data.warning) toast.warning(result.data.warning);
    else toast.success('Przeniesiono blok');
    ctx.refetch();
    ctx.onBlockUpdated?.();
  } catch {
    info.revert();
    toast.error('Błąd połączenia');
  }
}

export async function executeEventResize(info: EventResizeDoneInfo, ctx: CalendarActionContext): Promise<void> {
  if (!info.event.start || !info.event.end) {
    info.revert();
    return;
  }
  try {
    const result = await moveBlock({
      blockId: info.event.id,
      start: info.event.start.toISOString(),
      end: info.event.end.toISOString(),
    });
    if (!result.ok) {
      info.revert();
      toast.error(result.error ?? 'Nie udało się zmienić czasu trwania bloku');
      return;
    }
    if (result.data.warning) toast.warning(result.data.warning);
    else toast.success('Zmieniono czas trwania bloku');
    ctx.refetch();
    ctx.onBlockUpdated?.();
  } catch {
    info.revert();
    toast.error('Błąd połączenia');
  }
}

export async function executeExternalDrop(info: DropInfo, ctx: CalendarActionContext): Promise<void> {
  const taskId = info.draggedEl.getAttribute('data-task-id');
  if (!taskId) return;
  const durationStr = info.draggedEl.getAttribute('data-task-duration');
  const durationMinutes = parseDurationToMinutes(durationStr);
  const start = calculateDropStartIso(info.date, info.allDay, ctx.workStart, ctx.timeZone);

  try {
    const result = await scheduleTaskBlock({ taskId, start, durationMinutes });
    if (!result.ok) {
      toast.error(result.error ?? 'Nie udało się zaplanować zadania');
      return;
    }
    if (result.data.warning) toast.warning(result.data.warning);
    else toast.success('Zaplanowano zadanie w kalendarzu');
    ctx.refetch();
    ctx.onBlockUpdated?.();
  } catch {
    toast.error('Błąd połączenia');
  }
}
