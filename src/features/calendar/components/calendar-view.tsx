'use client';

import * as React from 'react';
import FullCalendar, {
  type CalendarRef,
  type DatesSetInfo,
  type DropInfo,
  type EventClickInfo,
  type EventDropInfo,
  type EventInput,
  type EventResizeDoneInfo,
  type EventSourceFuncInfo,
} from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import themePlugin from '@fullcalendar/react/themes/classic';
import plLocale from '@fullcalendar/react/locales/pl';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';

import { instantToLocalDate } from '@/domain/time';
import { moveBlock, scheduleTaskBlock } from '@/features/blocks/actions';
import { toast } from 'sonner';
import type { CalendarEventItem } from '../types';
import { BlockDialog } from './block-dialog';
import { renderCalendarEventContent } from './calendar-event-content';
import {
  calculateDropStartIso,
  DEFAULT_WARSAW_TIMEZONE,
  DEFAULT_WORK_START,
  extractBlockFromEvent,
  parseDurationToMinutes,
  resolveDropInstants,
} from './calendar-helpers';

export const MONDAY_FIRST_DAY = 1;
export const DEFAULT_SLOT_DURATION = '00:30:00';
export const DEFAULT_SLOT_MIN_TIME = '00:00:00';
export const DEFAULT_SLOT_MAX_TIME = '24:00:00';
export const DEFAULT_VIEW = 'timeGridWeek';

const HEADER_TOOLBAR = {
  left: 'prev,next today',
  center: 'title',
  right: 'timeGridDay,timeGridWeek,dayGridMonth',
} as const;

const BUTTON_LABELS = {
  today: { text: 'Dziś' },
  timeGridDay: { text: 'Dzień' },
  timeGridWeek: { text: 'Tydzień' },
  dayGridMonth: { text: 'Miesiąc' },
} as const;

export interface CalendarViewProps {
  readonly initialView?: 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';
  readonly workStart?: string;
  readonly timeZone?: string;
  readonly onDateChange?: (date: string) => void;
  readonly onBlockUpdated?: () => void;
  readonly className?: string;
}

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
    // Type assertion is safe because GET /api/calendar returns CalendarEventItem[] conforming to EventInput
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
    if (result.data.warning) {
      toast.warning(result.data.warning);
    } else {
      toast.success('Przeniesiono blok');
    }
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
    const start = info.event.start.toISOString();
    const end = info.event.end.toISOString();
    const result = await moveBlock({ blockId: info.event.id, start, end });
    if (!result.ok) {
      info.revert();
      toast.error(result.error ?? 'Nie udało się zmienić czasu trwania bloku');
      return;
    }
    if (result.data.warning) {
      toast.warning(result.data.warning);
    } else {
      toast.success('Zmieniono czas trwania bloku');
    }
    ctx.refetch();
    ctx.onBlockUpdated?.();
  } catch {
    info.revert();
    toast.error('Błąd połączenia');
  }
}

export async function executeExternalDrop(info: DropInfo, ctx: CalendarActionContext): Promise<void> {
  const taskId = info.draggedEl.getAttribute('data-task-id');
  if (!taskId) {
    return;
  }
  const durationStr = info.draggedEl.getAttribute('data-task-duration');
  const durationMinutes = parseDurationToMinutes(durationStr);
  const start = calculateDropStartIso(info.date, info.allDay, ctx.workStart, ctx.timeZone);

  try {
    const result = await scheduleTaskBlock({ taskId, start, durationMinutes });
    if (!result.ok) {
      toast.error(result.error ?? 'Nie udało się zaplanować zadania');
      return;
    }
    if (result.data.warning) {
      toast.warning(result.data.warning);
    } else {
      toast.success('Zaplanowano zadanie w kalendarzu');
    }
    ctx.refetch();
    ctx.onBlockUpdated?.();
  } catch {
    toast.error('Błąd połączenia');
  }
}

interface CalendarInteractionsParams {
  readonly calendarRef: React.RefObject<CalendarRef | null>;
  readonly workStart: string;
  readonly timeZone: string;
  readonly onBlockUpdated?: () => void;
  readonly onDateChange?: (date: string) => void;
  readonly onSelectBlock: (block: CalendarEventItem) => void;
}

function useCalendarInteractions({
  calendarRef,
  workStart,
  timeZone,
  onBlockUpdated,
  onDateChange,
  onSelectBlock,
}: CalendarInteractionsParams) {
  const refetch = React.useCallback(() => {
    calendarRef.current?.getApi().refetchEvents();
  }, [calendarRef]);

  const actionContext: CalendarActionContext = React.useMemo(
    () => ({ workStart, timeZone, refetch, onBlockUpdated }),
    [workStart, timeZone, refetch, onBlockUpdated],
  );

  const handleEventDrop = React.useCallback(
    (info: EventDropInfo) => {
      void executeEventDrop(info, actionContext);
    },
    [actionContext],
  );

  const handleEventResize = React.useCallback(
    (info: EventResizeDoneInfo) => {
      void executeEventResize(info, actionContext);
    },
    [actionContext],
  );

  const handleExternalDrop = React.useCallback(
    (info: DropInfo) => {
      void executeExternalDrop(info, actionContext);
    },
    [actionContext],
  );

  const handleEventClick = React.useCallback(
    (info: EventClickInfo) => {
      const block = extractBlockFromEvent(info.event);
      if (block) {
        onSelectBlock(block);
      }
    },
    [onSelectBlock],
  );

  const handleDatesSet = React.useCallback(
    (info: DatesSetInfo) => {
      const localDay = instantToLocalDate(info.view.currentStart.getTime(), timeZone);
      onDateChange?.(localDay);
    },
    [timeZone, onDateChange],
  );

  return { refetch, handleEventDrop, handleEventResize, handleExternalDrop, handleEventClick, handleDatesSet };
}

export function CalendarView({
  initialView = DEFAULT_VIEW,
  workStart = DEFAULT_WORK_START,
  timeZone = DEFAULT_WARSAW_TIMEZONE,
  onDateChange,
  onBlockUpdated,
  className,
}: CalendarViewProps) {
  const calendarRef = React.useRef<CalendarRef | null>(null);
  const [selectedBlock, setSelectedBlock] = React.useState<CalendarEventItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const { refetch, handleEventDrop, handleEventResize, handleExternalDrop, handleEventClick, handleDatesSet } =
    useCalendarInteractions({
      calendarRef,
      workStart,
      timeZone,
      onBlockUpdated,
      onDateChange,
      onSelectBlock: (block) => {
        setSelectedBlock(block);
        setIsDialogOpen(true);
      },
    });

  const scrollTimeString = `${workStart}:00`;

  return (
    <div className={className}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, themePlugin]}
        initialView={initialView}
        headerToolbar={HEADER_TOOLBAR}
        buttons={BUTTON_LABELS}
        locale={plLocale}
        firstDay={MONDAY_FIRST_DAY}
        slotDuration={DEFAULT_SLOT_DURATION}
        slotMinTime={DEFAULT_SLOT_MIN_TIME}
        slotMaxTime={DEFAULT_SLOT_MAX_TIME}
        scrollTime={scrollTimeString}
        nowIndicator={true}
        editable={true}
        droppable={true}
        events={fetchCalendarEvents}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        drop={handleExternalDrop}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        eventContent={renderCalendarEventContent}
      />
      <BlockDialog
        block={selectedBlock}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        timeZone={timeZone}
        onBlockUpdated={() => {
          refetch();
          onBlockUpdated?.();
        }}
      />
    </div>
  );
}
