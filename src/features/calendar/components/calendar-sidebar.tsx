'use client';

import * as React from 'react';
import { pl } from 'date-fns/locale';
import { GraduationCapIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { HabitChecklist } from '@/features/habits/components/habit-checklist';
import { RecurringEventsDialog } from '@/features/recurring-events/components/recurring-events-dialog';
import type { UnclosedBlockItem } from '@/features/blocks/types';
import type { RecurringEventWithRelations } from '@/features/recurring-events/types';
import { CloseDayBanner } from './close-day-banner';

export const DAY_VIEW_NAME = 'timeGridDay';

export function isDayView(currentView: string): boolean {
  return currentView === DAY_VIEW_NAME;
}

export interface TaskTypeSidebarItem {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly energy?: number;
}

export function countActiveTaskTypes(
  taskTypes: readonly TaskTypeSidebarItem[],
  hiddenTypeIds?: ReadonlySet<string>,
): number {
  if (!hiddenTypeIds || hiddenTypeIds.size === 0) {
    return taskTypes.length;
  }
  return taskTypes.filter((type) => !hiddenTypeIds.has(type.id)).length;
}

export interface CalendarMiniNavProps {
  readonly selectedDate: Date;
  readonly onDateSelect: (date: Date) => void;
}

export function CalendarMiniNav({ selectedDate, onDateSelect }: CalendarMiniNavProps) {
  return (
    <div className="rounded-lg border bg-card p-1 shadow-2xs">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(date) => {
          if (date) {
            onDateSelect(date);
          }
        }}
        locale={pl}
        className="w-full p-2"
      />
    </div>
  );
}

export interface CalendarLessonPlanButtonProps {
  readonly onClick: () => void;
}

export function CalendarLessonPlanButton({ onClick }: CalendarLessonPlanButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full justify-start gap-2 text-sm font-medium"
      onClick={onClick}
      aria-label="Otwórz plan lekcji"
    >
      <GraduationCapIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>Plan lekcji</span>
    </Button>
  );
}

export interface CalendarTypeItemRowProps {
  readonly type: TaskTypeSidebarItem;
  readonly checked: boolean;
  readonly onToggle?: (typeId: string) => void;
}

export function CalendarTypeItemRow({ type, checked, onToggle }: CalendarTypeItemRowProps) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <Checkbox
        id={`type-filter-${type.id}`}
        checked={checked}
        onCheckedChange={() => onToggle?.(type.id)}
        aria-label={type.name}
      />
      <label
        htmlFor={`type-filter-${type.id}`}
        className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer select-none text-foreground truncate"
      >
        <span
          className="size-2.5 shrink-0 rounded-full border border-black/10 dark:border-white/10"
          style={{ backgroundColor: type.color }}
          aria-hidden="true"
        />
        <span className="truncate">{type.name}</span>
      </label>
    </div>
  );
}

export interface CalendarTypeFilterProps {
  readonly taskTypes: readonly TaskTypeSidebarItem[];
  readonly hiddenTypeIds?: ReadonlySet<string>;
  readonly onToggleTypeVisibility?: (typeId: string) => void;
}

export function CalendarTypeFilter({
  taskTypes,
  hiddenTypeIds,
  onToggleTypeVisibility,
}: CalendarTypeFilterProps) {
  const totalCount = taskTypes.length;
  const activeCount = countActiveTaskTypes(taskTypes, hiddenTypeIds);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Filtruj zadania</span>
        <span>
          {activeCount}/{totalCount}
        </span>
      </div>
      {totalCount === 0 ? (
        <p className="text-xs text-muted-foreground">Brak typów zadań</p>
      ) : (
        <div className="flex flex-col gap-0.5" role="group" aria-label="Filtruj zadania wg typu">
          {taskTypes.map((type) => (
            <CalendarTypeItemRow
              key={type.id}
              type={type}
              checked={!hiddenTypeIds?.has(type.id)}
              onToggle={onToggleTypeVisibility}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export interface CalendarHabitsSectionProps {
  readonly selectedDayStr: string;
}

export function CalendarHabitsSection({ selectedDayStr }: CalendarHabitsSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Nawyki na dzień
      </h4>
      <HabitChecklist day={selectedDayStr} />
    </div>
  );
}

export interface CalendarSidebarProps {
  readonly taskTypes: readonly TaskTypeSidebarItem[];
  readonly selectedDate: Date;
  readonly onDateSelect: (date: Date) => void;
  readonly currentView: string;
  readonly selectedDayStr: string;
  readonly unclosedBlocks?: readonly UnclosedBlockItem[];
  readonly onBlockClosed?: (blockId: string) => void;
  readonly hiddenTypeIds?: ReadonlySet<string>;
  readonly onToggleTypeVisibility?: (typeId: string) => void;
  readonly recurringEvents?: readonly RecurringEventWithRelations[];
  readonly onRecurringEventsChanged?: () => void;
  readonly timeZone?: string;
  readonly recurringDialogOpen?: boolean;
  readonly onRecurringDialogOpenChange?: (open: boolean) => void;
}

export interface CalendarSidebarViewProps extends CalendarSidebarProps {
  readonly isDialogOpen: boolean;
  readonly onDialogOpenChange: (open: boolean) => void;
}

export function CalendarSidebarView({
  taskTypes,
  selectedDate,
  onDateSelect,
  currentView,
  selectedDayStr,
  unclosedBlocks,
  onBlockClosed,
  hiddenTypeIds,
  onToggleTypeVisibility,
  recurringEvents,
  onRecurringEventsChanged,
  timeZone,
  isDialogOpen,
  onDialogOpenChange,
}: CalendarSidebarViewProps) {
  return (
    <aside aria-label="Boczny panel kalendarza" className="flex flex-col gap-6">
      <CloseDayBanner
        unclosedBlocks={unclosedBlocks ?? []}
        timeZone={timeZone}
        onBlockClosed={onBlockClosed}
      />

      <CalendarMiniNav selectedDate={selectedDate} onDateSelect={onDateSelect} />

      <CalendarLessonPlanButton onClick={() => onDialogOpenChange(true)} />

      <CalendarTypeFilter
        taskTypes={taskTypes}
        hiddenTypeIds={hiddenTypeIds}
        onToggleTypeVisibility={onToggleTypeVisibility}
      />

      {isDayView(currentView) && (
        <CalendarHabitsSection selectedDayStr={selectedDayStr} />
      )}

      <RecurringEventsDialog
        open={isDialogOpen}
        onOpenChange={onDialogOpenChange}
        taskTypes={taskTypes}
        events={recurringEvents}
        onEventsChanged={onRecurringEventsChanged}
        timeZone={timeZone}
      />
    </aside>
  );
}

export function CalendarSidebar(props: CalendarSidebarProps) {
  const [internalDialogOpen, setInternalDialogOpen] = React.useState(false);
  const isDialogOpen = props.recurringDialogOpen ?? internalDialogOpen;
  const handleDialogChange = props.onRecurringDialogOpenChange ?? setInternalDialogOpen;

  return (
    <CalendarSidebarView
      {...props}
      isDialogOpen={isDialogOpen}
      onDialogOpenChange={handleDialogChange}
    />
  );
}
