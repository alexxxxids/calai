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
  readonly onViewChange?: (view: string) => void;
  readonly onBlockUpdated?: () => void;
  readonly selectedDate?: Date | string;
  readonly hiddenTypeIds?: ReadonlySet<string>;
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

interface CalendarInteractionsParams {
  readonly calendarRef: React.RefObject<CalendarRef | null>;
  readonly workStart: string;
  readonly timeZone: string;
  readonly onBlockUpdated?: () => void;
  readonly onDateChange?: (date: string) => void;
  readonly onViewChange?: (view: string) => void;
  readonly onSelectBlock: (block: CalendarEventItem) => void;
}

function useCalendarInteractions({
  calendarRef,
  workStart,
  timeZone,
  onBlockUpdated,
  onDateChange,
  onViewChange,
  onSelectBlock,
}: CalendarInteractionsParams) {
  const refetch = React.useCallback(() => {
    calendarRef.current?.getApi().refetchEvents();
  }, [calendarRef]);

  const actionContext: CalendarActionContext = React.useMemo(
    () => ({ workStart, timeZone, refetch, onBlockUpdated }),
    [workStart, timeZone, refetch, onBlockUpdated],
  );

  const handleDatesSet = React.useCallback(
    (info: DatesSetInfo) => {
      onDateChange?.(instantToLocalDate(info.view.currentStart.getTime(), timeZone));
      onViewChange?.(info.view.type);
    },
    [timeZone, onDateChange, onViewChange],
  );

  return {
    refetch,
    handleEventDrop: (info: EventDropInfo) => { void executeEventDrop(info, actionContext); },
    handleEventResize: (info: EventResizeDoneInfo) => { void executeEventResize(info, actionContext); },
    handleExternalDrop: (info: DropInfo) => { void executeExternalDrop(info, actionContext); },
    handleEventClick: (info: EventClickInfo) => {
      const block = extractBlockFromEvent(info.event);
      if (block) onSelectBlock(block);
    },
    handleDatesSet,
  };
}

function useCalendarFilteredEvents(
  hiddenTypeIds: ReadonlySet<string> | undefined,
  calendarRef: React.RefObject<CalendarRef | null>,
) {
  React.useEffect(() => {
    calendarRef.current?.getApi().refetchEvents();
  }, [hiddenTypeIds, calendarRef]);

  return React.useCallback(
    async (fetchInfo: EventSourceFuncInfo) => {
      const items = await fetchCalendarEvents(fetchInfo);
      if (!hiddenTypeIds || hiddenTypeIds.size === 0) return items;
      return items.filter((event) => {
        const ext = event.extendedProps as { typeId?: string | null } | undefined;
        return !ext?.typeId || !hiddenTypeIds.has(ext.typeId);
      });
    },
    [hiddenTypeIds],
  );
}

export function CalendarView({
  initialView = DEFAULT_VIEW,
  workStart = DEFAULT_WORK_START,
  timeZone = DEFAULT_WARSAW_TIMEZONE,
  onDateChange,
  onViewChange,
  onBlockUpdated,
  selectedDate,
  hiddenTypeIds,
  className,
}: CalendarViewProps) {
  const calendarRef = React.useRef<CalendarRef | null>(null);
  const [selectedBlock, setSelectedBlock] = React.useState<CalendarEventItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (selectedDate && calendarRef.current) {
      calendarRef.current.getApi().gotoDate(selectedDate);
    }
  }, [selectedDate]);

  const { refetch, handleEventDrop, handleEventResize, handleExternalDrop, handleEventClick, handleDatesSet } =
    useCalendarInteractions({
      calendarRef,
      workStart,
      timeZone,
      onBlockUpdated,
      onDateChange,
      onViewChange,
      onSelectBlock: (block) => {
        setSelectedBlock(block);
        setIsDialogOpen(true);
      },
    });

  const handleFetchEvents = useCalendarFilteredEvents(hiddenTypeIds, calendarRef);

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
        scrollTime={`${workStart}:00`}
        nowIndicator={true}
        editable={true}
        droppable={true}
        events={handleFetchEvents}
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
