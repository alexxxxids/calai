'use client';

import * as React from 'react';
import { Trash2Icon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { localDeleteRecurringEvent } from '@/lib/local-store';
import type { RecurringEventWithRelations } from '../types';
import { RecurringEventForm, type TaskTypeOption } from './recurring-events-form';
import {
  executeDeleteRecurringEvent,
  formatEventTimeRange,
  groupEventsByWeekday,
  WEEKDAYS,
} from './recurring-events-helpers';

export type { TaskTypeOption };

export interface RecurringEventsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly taskTypes: readonly TaskTypeOption[];
  readonly events?: readonly RecurringEventWithRelations[];
  readonly onEventsChanged?: () => void;
  readonly timeZone?: string;
  readonly deletingId?: string | null;
  readonly isSubmitting?: boolean;
}

function RecurringEventRow({
  event,
  taskTypes,
  onDelete,
  isDeleting,
}: {
  readonly event: RecurringEventWithRelations;
  readonly taskTypes: readonly TaskTypeOption[];
  readonly onDelete: (id: string) => void;
  readonly isDeleting: boolean;
}) {
  const typeColor =
    event.task_types?.color ??
    taskTypes.find((t) => t.id === event.type_id)?.color ??
    '#6b7280';
  const typeName =
    event.task_types?.name ??
    taskTypes.find((t) => t.id === event.type_id)?.name ??
    'Inne';

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
      <div className="flex flex-col gap-0.5 truncate">
        <span className="font-medium truncate">{event.title}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatEventTimeRange(event.start_time, event.end_time)}</span>
          {event.valid_until ? <span>(do {event.valid_until})</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className="flex items-center gap-1.5 text-xs font-normal">
          <span
            className="size-2 rounded-full border border-black/10 dark:border-white/10"
            style={{ backgroundColor: typeColor }}
            aria-hidden="true"
          />
          <span>{typeName}</span>
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(event.id)}
          disabled={isDeleting}
          aria-label={`Usuń ${event.title}`}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function WeekdayEventsSection({
  events,
  taskTypes,
  onDelete,
  deletingId,
  isSubmitting = false,
}: {
  readonly events?: readonly RecurringEventWithRelations[];
  readonly taskTypes: readonly TaskTypeOption[];
  readonly onDelete: (id: string) => void;
  readonly deletingId: string | null;
  readonly isSubmitting?: boolean;
}) {
  const eventsByWeekday = React.useMemo(() => groupEventsByWeekday(events), [events]);
  const hasEvents = (events?.length ?? 0) > 0;

  if (!hasEvents) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        Brak zaplanowanych stałych zajęć.
      </div>
    );
  }

  const isDeletingAny = Boolean(deletingId) || isSubmitting;

  return (
    <div className="space-y-3">
      {WEEKDAYS.map((day) => {
        const dayEvents = eventsByWeekday.get(day.value);
        if (!dayEvents || dayEvents.length === 0) {
          return null;
        }
        return (
          <div key={day.value} className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {day.label}
            </h4>
            <div className="space-y-1">
              {dayEvents.map((event) => (
                <RecurringEventRow
                  key={event.id}
                  event={event}
                  taskTypes={taskTypes}
                  onDelete={onDelete}
                  isDeleting={isDeletingAny}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RecurringEventsDialog({
  open,
  onOpenChange,
  taskTypes,
  events,
  onEventsChanged,
  timeZone,
  deletingId: propsDeletingId,
  isSubmitting: propsIsSubmitting,
}: RecurringEventsDialogProps) {
  const [internalDeletingId, setInternalDeletingId] = React.useState<string | null>(null);
  const [internalIsSubmitting, setInternalIsSubmitting] = React.useState(false);

  const deletingId = propsDeletingId !== undefined ? propsDeletingId : internalDeletingId;
  const isSubmitting = propsIsSubmitting !== undefined ? propsIsSubmitting : internalIsSubmitting;
  const isLocked = Boolean(deletingId) || isSubmitting;

  const handleDelete = (id: string) => {
    if (isLocked) {
      return;
    }
    setInternalDeletingId(id);
    void executeDeleteRecurringEvent(
      async () => localDeleteRecurringEvent({ id }),
      () => {
        setInternalDeletingId(null);
        onEventsChanged?.();
      },
    ).finally(() => {
      setInternalDeletingId(null);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan lekcji</DialogTitle>
          <DialogDescription>
            Zarządzaj stałymi zajęciami i lekcjami powtarzającymi się w tygodniu.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <WeekdayEventsSection
            events={events}
            taskTypes={taskTypes}
            onDelete={handleDelete}
            deletingId={deletingId}
            isSubmitting={isSubmitting}
          />

          <Separator />

          <RecurringEventForm
            taskTypes={taskTypes}
            onCreated={onEventsChanged}
            timeZone={timeZone}
            isSubmitting={isSubmitting}
            onSubmittingChange={setInternalIsSubmitting}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Zamknij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
