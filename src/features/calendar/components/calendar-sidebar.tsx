'use client';

import * as React from 'react';
import { pl } from 'date-fns/locale';
import { GraduationCapIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import type { UnclosedBlockItem } from '@/features/blocks/types';
import { HabitChecklist } from '@/features/habits/components/habit-checklist';
import { RecurringEventsDialog } from '@/features/recurring-events/components/recurring-events-dialog';
import type { RecurringEventWithRelations } from '@/features/recurring-events/types';
import { TaskTypesDialog } from '@/features/task-types/components/task-types-dialog';
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

export function CalendarMiniNav({
  selectedDate,
  onDateSelect,
}: {
  readonly selectedDate: Date;
  readonly onDateSelect: (date: Date) => void;
}) {
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

export function CalendarLessonPlanButton({ onClick }: { readonly onClick: () => void }) {
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

export function CalendarTypeItemRow({
  type,
  checked,
  onToggle,
}: {
  readonly type: TaskTypeSidebarItem;
  readonly checked: boolean;
  readonly onToggle?: (typeId: string) => void;
}) {
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

export function CalendarTypeFilter({
  taskTypes,
  hiddenTypeIds,
  onToggleTypeVisibility,
}: {
  readonly taskTypes: readonly TaskTypeSidebarItem[];
  readonly hiddenTypeIds?: ReadonlySet<string>;
  readonly onToggleTypeVisibility?: (typeId: string) => void;
}) {
  const totalCount = taskTypes.length;
  const activeCount = countActiveTaskTypes(taskTypes, hiddenTypeIds);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Filtruj zadania</span>
          <span>
            {activeCount}/{totalCount}
          </span>
        </div>
        <TaskTypesDialog taskTypes={taskTypes} triggerLabel="Dodaj / usuń" />
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

export function CalendarHabitsSection({ selectedDayStr }: { readonly selectedDayStr: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <h4>Nawyki na dzień</h4>
        <span className="font-normal">{selectedDayStr}</span>
      </div>
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

export function CalendarSidebar(props: CalendarSidebarProps) {
  const [internalDialogOpen, setInternalDialogOpen] = React.useState(false);
  const isDialogOpen = props.recurringDialogOpen ?? internalDialogOpen;
  const handleDialogChange = props.onRecurringDialogOpenChange ?? setInternalDialogOpen;

  return (
    <aside aria-label="Boczny panel kalendarza" className="flex flex-col gap-6">
      <CloseDayBanner
        unclosedBlocks={props.unclosedBlocks ?? []}
        timeZone={props.timeZone}
        onBlockClosed={props.onBlockClosed}
      />

      <CalendarMiniNav selectedDate={props.selectedDate} onDateSelect={props.onDateSelect} />

      <CalendarLessonPlanButton onClick={() => handleDialogChange(true)} />

      <CalendarTypeFilter
        taskTypes={props.taskTypes}
        hiddenTypeIds={props.hiddenTypeIds}
        onToggleTypeVisibility={props.onToggleTypeVisibility}
      />

      <CalendarHabitsSection selectedDayStr={props.selectedDayStr} />

      <RecurringEventsDialog
        open={isDialogOpen}
        onOpenChange={handleDialogChange}
        taskTypes={props.taskTypes}
        events={props.recurringEvents}
        onEventsChanged={props.onRecurringEventsChanged}
        timeZone={props.timeZone}
      />
    </aside>
  );
}
