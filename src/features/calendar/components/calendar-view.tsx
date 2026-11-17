'use client';

import * as React from 'react';
import FullCalendar, {
  type CalendarRef,
  type DatesSetInfo,
  type DropInfo,
  type EventClickInfo,
  type EventDropInfo,
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
import { getLocalStoreVersion, subscribeLocalStore } from '@/lib/local-store';
import type { CalendarEventItem } from '../types';
import {
  executeEventDrop,
  executeEventResize,
  executeExternalDrop,
  fetchCalendarEvents,
  type CalendarActionContext,
} from './calendar-actions';
import { BlockDialog } from './block-dialog';
import { renderCalendarEventContent } from './calendar-event-content';
import {
  DEFAULT_WARSAW_TIMEZONE,
  DEFAULT_WORK_START,
  extractBlockFromEvent,
} from './calendar-helpers';

export {
  executeEventDrop,
  executeEventResize,
  executeExternalDrop,
  fetchCalendarEvents,
  type CalendarActionContext,
};

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
  readonly refreshTrigger?: number;
  readonly className?: string;
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
      if (block) onSelectBlock(block);
    },
    [onSelectBlock],
  );

  return {
    refetch,
    handleEventDrop,
    handleEventResize,
    handleExternalDrop,
    handleEventClick,
    handleDatesSet,
  };
}

function useCalendarFilteredEvents(
  hiddenTypeIds: ReadonlySet<string> | undefined,
  calendarRef: React.RefObject<CalendarRef | null>,
) {
  const hiddenTypeIdsRef = React.useRef(hiddenTypeIds);

  React.useEffect(() => {
    hiddenTypeIdsRef.current = hiddenTypeIds;
    calendarRef.current?.getApi().refetchEvents();
  }, [hiddenTypeIds, calendarRef]);

  return React.useCallback(
    async (fetchInfo: EventSourceFuncInfo) => {
      const items = await fetchCalendarEvents(fetchInfo);
      const currentHidden = hiddenTypeIdsRef.current;
      if (!currentHidden || currentHidden.size === 0) return items;
      return items.filter((event) => {
        const ext = event.extendedProps as { typeId?: string | null } | undefined;
        return !ext?.typeId || !currentHidden.has(ext.typeId);
      });
    },
    [],
  );
}

function useCalendarStoreSync(
  calendarRef: React.RefObject<CalendarRef | null>,
  selectedDate: Date | string | undefined,
  refreshTrigger: number | undefined,
) {
  const storeVersion = React.useSyncExternalStore(
    subscribeLocalStore,
    getLocalStoreVersion,
    () => 0,
  );

  React.useEffect(() => {
    if (selectedDate && calendarRef.current) {
      calendarRef.current.getApi().gotoDate(selectedDate);
    }
  }, [calendarRef, selectedDate]);

  React.useEffect(() => {
    if ((refreshTrigger !== undefined && refreshTrigger > 0) || storeVersion > 0) {
      calendarRef.current?.getApi().refetchEvents();
    }
  }, [calendarRef, refreshTrigger, storeVersion]);
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
  refreshTrigger,
  className,
}: CalendarViewProps) {
  const calendarRef = React.useRef<CalendarRef | null>(null);
  const [selectedBlock, setSelectedBlock] = React.useState<CalendarEventItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  useCalendarStoreSync(calendarRef, selectedDate, refreshTrigger);

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
        timeZone={timeZone}
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
