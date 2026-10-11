'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { InboxIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { instantToLocalDate } from '@/domain/time';
import type { UnclosedBlockItem } from '@/features/blocks/types';
import type { TaskTypeRow } from '@/features/task-types';
import { BacklogPanel } from '@/features/tasks/components/backlog-panel';
import type { BacklogTaskItem } from '@/features/tasks/types';

import {
  DEFAULT_WARSAW_TIMEZONE,
  DEFAULT_WORK_START,
} from './calendar-helpers';
import { CalendarSidebar, type TaskTypeSidebarItem } from './calendar-sidebar';
import { CalendarView, DEFAULT_VIEW } from './calendar-view';
import { CloseDayBanner } from './close-day-banner';

export interface CalendarPageContentProps {
  readonly tasks: readonly BacklogTaskItem[];
  readonly taskTypes: readonly TaskTypeRow[];
  readonly unclosedBlocks: readonly UnclosedBlockItem[];
  readonly timeZone?: string;
  readonly workStart?: string;
  readonly onDataUpdated?: () => void;
  readonly className?: string;
}

export function mapTaskTypesToSidebarItems(
  taskTypes: readonly TaskTypeRow[],
): readonly TaskTypeSidebarItem[] {
  return taskTypes.map((type) => ({
    id: type.id,
    name: type.name,
    color: type.color,
    energy: type.energy,
  }));
}

interface CalendarMobileBarProps {
  readonly tasksCount: number;
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly children: React.ReactNode;
}

function CalendarMobileBar({
  tasksCount,
  isOpen,
  onOpenChange,
  children,
}: CalendarMobileBarProps) {
  return (
    <div className="flex items-center justify-between lg:hidden">
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 font-medium"
            aria-label={`Do zaplanowania: ${tasksCount} zadań`}
          >
            <InboxIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>Do zaplanowania</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {tasksCount}
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto p-6">
          <SheetHeader className="p-0 mb-4">
            <SheetTitle>Do zaplanowania</SheetTitle>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface CalendarDesktopColumnsProps {
  readonly backlog: React.ReactNode;
  readonly calendar: React.ReactNode;
  readonly sidebar: React.ReactNode;
}

function CalendarDesktopColumns({
  backlog,
  calendar,
  sidebar,
}: CalendarDesktopColumnsProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <aside aria-label="Panel boczny zadań" className="hidden lg:block w-80 shrink-0">
        <div className="sticky top-6">{backlog}</div>
      </aside>
      <main aria-label="Widok kalendarza" className="flex-1 min-w-0 w-full">
        {calendar}
      </main>
      <aside aria-label="Panel boczny nawigacji kalendarza" className="w-full lg:w-72 shrink-0">
        <div className="sticky top-6">{sidebar}</div>
      </aside>
    </div>
  );
}

function useCalendarPageState({
  unclosedBlocks,
  timeZone,
  onDataUpdated,
}: {
  readonly unclosedBlocks: readonly UnclosedBlockItem[];
  readonly timeZone: string;
  readonly onDataUpdated?: () => void;
}) {
  const router = useRouter();
  const [closedBlockIds, setClosedBlockIds] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [selectedDate, setSelectedDate] = React.useState<Date>(() => new Date());
  const [selectedDayStr, setSelectedDayStr] = React.useState<string>(() =>
    instantToLocalDate(Date.now(), timeZone),
  );
  const [currentView, setCurrentView] = React.useState<string>(DEFAULT_VIEW);
  const [hiddenTypeIds, setHiddenTypeIds] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [isMobileBacklogOpen, setIsMobileBacklogOpen] = React.useState(false);

  const activeUnclosedBlocks = React.useMemo(
    () => unclosedBlocks.filter((item) => !closedBlockIds.has(item.id)),
    [unclosedBlocks, closedBlockIds],
  );

  const handleRefresh = React.useCallback(() => {
    onDataUpdated?.();
    router.refresh();
  }, [onDataUpdated, router]);

  const handleBlockClosed = React.useCallback(
    (blockId: string) => {
      setClosedBlockIds((prev) => new Set(prev).add(blockId));
      handleRefresh();
    },
    [handleRefresh],
  );

  const handleDateSelect = React.useCallback(
    (date: Date) => {
      setSelectedDate(date);
      setSelectedDayStr(instantToLocalDate(date.getTime(), timeZone));
    },
    [timeZone],
  );

  const handleToggleTypeVisibility = React.useCallback((typeId: string) => {
    setHiddenTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
  }, []);

  return {
    activeUnclosedBlocks,
    selectedDate,
    selectedDayStr,
    setSelectedDayStr,
    currentView,
    setCurrentView,
    hiddenTypeIds,
    isMobileBacklogOpen,
    setIsMobileBacklogOpen,
    handleRefresh,
    handleBlockClosed,
    handleDateSelect,
    handleToggleTypeVisibility,
  };
}

export function CalendarPageContent({
  tasks,
  taskTypes,
  unclosedBlocks,
  timeZone = DEFAULT_WARSAW_TIMEZONE,
  workStart = DEFAULT_WORK_START,
  onDataUpdated,
  className,
}: CalendarPageContentProps) {
  const state = useCalendarPageState({ unclosedBlocks, timeZone, onDataUpdated });
  const sidebarTaskTypes = React.useMemo(
    () => mapTaskTypesToSidebarItems(taskTypes),
    [taskTypes],
  );

  const backlogNode = (
    <BacklogPanel
      tasks={tasks}
      taskTypes={taskTypes}
      timeZone={timeZone}
      onUpdated={state.handleRefresh}
    />
  );

  return (
    <div className={`flex flex-col gap-6 p-4 sm:p-6 lg:p-8 ${className ?? ''}`}>
      {state.activeUnclosedBlocks.length > 0 && (
        <div className="w-full">
          <CloseDayBanner
            unclosedBlocks={state.activeUnclosedBlocks}
            timeZone={timeZone}
            onBlockClosed={state.handleBlockClosed}
          />
        </div>
      )}

      <CalendarMobileBar
        tasksCount={tasks.length}
        isOpen={state.isMobileBacklogOpen}
        onOpenChange={state.setIsMobileBacklogOpen}
      >
        {backlogNode}
      </CalendarMobileBar>

      <CalendarDesktopColumns
        backlog={backlogNode}
        calendar={
          <CalendarView
            workStart={workStart}
            timeZone={timeZone}
            selectedDate={state.selectedDate}
            onDateChange={state.setSelectedDayStr}
            onViewChange={state.setCurrentView}
            onBlockUpdated={state.handleRefresh}
            hiddenTypeIds={state.hiddenTypeIds}
          />
        }
        sidebar={
          <CalendarSidebar
            taskTypes={sidebarTaskTypes}
            selectedDate={state.selectedDate}
            onDateSelect={state.handleDateSelect}
            currentView={state.currentView}
            selectedDayStr={state.selectedDayStr}
            unclosedBlocks={[]}
            hiddenTypeIds={state.hiddenTypeIds}
            onToggleTypeVisibility={state.handleToggleTypeVisibility}
            timeZone={timeZone}
          />
        }
      />
    </div>
  );
}
