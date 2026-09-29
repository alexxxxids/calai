'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarIcon, CheckIcon, ClockIcon, PencilIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cancelTask, completeTask } from '../actions';
import type { BacklogTaskItem } from '../types';
import { TaskFormDialog } from './task-form-dialog';
import {
  DEFAULT_SESSION_MINUTES,
  MAX_NOTE_SNIPPET_LENGTH,
  MINUTES_PER_HOUR,
  PRIORITY_HIGH,
  PRIORITY_MEDIUM,
  type TaskTypeOption,
} from './task-form-types';
import { formatDate, formatMinutes } from '@/lib/format';

interface BacklogItemProps {
  readonly task: BacklogTaskItem;
  readonly taskTypes?: readonly TaskTypeOption[];
  readonly timeZone?: string;
  readonly onUpdated?: () => void;
}

function getTaskDurationString(sessionMinutes: number | null): string {
  const minutes = sessionMinutes ?? DEFAULT_SESSION_MINUTES;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const mins = minutes % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function getTaskTitle(typeName: string, notes: string | null): string {
  const trimmed = notes?.trim();
  if (trimmed && trimmed.length > 0) {
    const snippet =
      trimmed.length > MAX_NOTE_SNIPPET_LENGTH
        ? `${trimmed.slice(0, MAX_NOTE_SNIPPET_LENGTH)}...`
        : trimmed;
    return `${typeName}: ${snippet}`;
  }
  return typeName;
}

function BacklogItemBadges({
  task,
  timeZone,
}: {
  readonly task: BacklogTaskItem;
  readonly timeZone: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {task.priority === PRIORITY_HIGH && (
        <Badge variant="destructive" className="text-xs">
          Wysoki
        </Badge>
      )}
      {task.priority === PRIORITY_MEDIUM && (
        <Badge variant="secondary" className="text-xs">
          Średni
        </Badge>
      )}
      {task.priority !== PRIORITY_HIGH && task.priority !== PRIORITY_MEDIUM && (
        <Badge variant="outline" className="text-xs">
          Niski
        </Badge>
      )}

      {task.estimateMinutes !== null ? (
        <Badge variant="outline" className="gap-1 text-xs">
          <ClockIcon className="size-3" aria-hidden="true" />
          {formatMinutes(task.estimateMinutes)}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Pomysł
        </Badge>
      )}

      {task.deadline && (
        <Badge
          variant="outline"
          className="gap-1 border-amber-300 text-xs text-amber-700 dark:border-amber-800 dark:text-amber-400"
        >
          <CalendarIcon className="size-3" aria-hidden="true" />
          {formatDate(new Date(task.deadline), timeZone)}
        </Badge>
      )}
    </div>
  );
}

function BacklogItemActions({
  task,
  taskTypes,
  isPending,
  onComplete,
  onCancel,
  onUpdated,
}: {
  readonly task: BacklogTaskItem;
  readonly taskTypes?: readonly TaskTypeOption[];
  readonly isPending: boolean;
  readonly onComplete: () => void;
  readonly onCancel: () => void;
  readonly onUpdated?: () => void;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <TaskFormDialog initialData={task} taskTypes={taskTypes} onSuccess={onUpdated}>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label={`Edytuj zadanie ${task.typeName}`}
        >
          <PencilIcon className="size-4" aria-hidden="true" />
        </Button>
      </TaskFormDialog>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
        disabled={isPending}
        onClick={onComplete}
        aria-label={`Ukończ zadanie ${task.typeName}`}
      >
        <CheckIcon className="size-4" aria-hidden="true" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        disabled={isPending}
        onClick={onCancel}
        aria-label={`Anuluj zadanie ${task.typeName}`}
      >
        <XIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function BacklogItem({
  task,
  taskTypes,
  timeZone = 'Europe/Warsaw',
  onUpdated,
}: BacklogItemProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const title = getTaskTitle(task.typeName, task.notes);
  const duration = getTaskDurationString(task.sessionMinutes);

  const handleComplete = () => {
    startTransition(async () => {
      const result = await completeTask({ taskId: task.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Zadanie ukończone');
      router.refresh();
      onUpdated?.();
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelTask({ taskId: task.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Zadanie anulowane');
      router.refresh();
      onUpdated?.();
    });
  };

  return (
    <div
      className="fc-backlog-task group flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-2xs transition-colors hover:border-primary/50 sm:flex-row sm:items-center"
      data-task-id={task.id}
      data-task-title={title}
      data-task-duration={duration}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span
          className="mt-1 size-3.5 shrink-0 rounded-full border border-black/10 dark:border-white/10"
          style={{ backgroundColor: task.typeColor }}
          aria-hidden="true"
        />
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm truncate">{task.typeName}</span>
            {task.isOneOff && (
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
                Jednorazowy
              </span>
            )}
          </div>
          {task.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2 break-words">{task.notes}</p>
          )}
          <BacklogItemBadges task={task} timeZone={timeZone} />
        </div>
      </div>

      <BacklogItemActions
        task={task}
        taskTypes={taskTypes}
        isPending={isPending}
        onComplete={handleComplete}
        onCancel={handleCancel}
        onUpdated={onUpdated}
      />
    </div>
  );
}
