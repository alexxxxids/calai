'use client';

import * as React from 'react';
import { Draggable } from '@fullcalendar/react/interaction';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InboxIcon,
  Loader2Icon,
  PlusIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { localRunPlanner } from '@/lib/local-planner';
import type { RunPlannerResult } from '@/features/planner/types';
import type { BacklogTaskItem } from '../types';
import { BacklogItem } from './backlog-item';
import { TaskFormDialog } from './task-form-dialog';
import type { TaskTypeOption } from './task-form-types';

interface BacklogPanelProps {
  readonly tasks: readonly BacklogTaskItem[];
  readonly taskTypes?: readonly TaskTypeOption[];
  readonly timeZone?: string;
  readonly onUpdated?: () => void;
}

function PlannerReportCard({
  report,
  onDismiss,
}: {
  readonly report: RunPlannerResult;
  readonly onDismiss: () => void;
}) {
  const hasUnscheduled = report.unscheduled.length > 0;

  return (
    <div
      className={`relative rounded-lg border p-4 text-sm ${
        hasUnscheduled
          ? 'border-amber-300 bg-amber-50/50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
          : 'border-emerald-300 bg-emerald-50/50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
      }`}
    >
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        aria-label="Zamknij raport"
      >
        <XIcon className="size-4" />
      </button>

      <div className="flex items-center gap-2 font-medium">
        {hasUnscheduled ? (
          <AlertTriangleIcon className="size-4 text-amber-600 dark:text-amber-400" />
        ) : (
          <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
        )}
        <span>Zaplanowano bloków: {report.placed}</span>
      </div>

      {hasUnscheduled ? (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-semibold">Niektóre zadania nie zmieściły się w planie:</p>
          <ul className="list-disc pl-5 text-xs space-y-0.5">
            {report.unscheduled.map((item) => (
              <li key={item.taskId}>
                Nie zdążysz: <span className="font-medium">{item.taskTitle}</span> — brak{' '}
                {item.missingMinutes} min (powód:{' '}
                {item.reason === 'deadline' ? 'termin' : 'brak miejsca'})
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Wszystkie zadania zmieściły się w Twoim planie.
        </p>
      )}
    </div>
  );
}

function BacklogEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
      <InboxIcon className="size-8 text-muted-foreground mb-2 opacity-50" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">
        Brak zadań w skrzynce. Wszystko zaplanowane!
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Dodaj nowe zadanie za pomocą przycisku powyżej.
      </p>
    </div>
  );
}

function BacklogHeader({
  count,
  taskTypes,
  isPending,
  onPlan,
  onUpdated,
}: {
  readonly count: number;
  readonly taskTypes?: readonly TaskTypeOption[];
  readonly isPending: boolean;
  readonly onPlan: () => void;
  readonly onUpdated?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Skrzynka zadań</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <TaskFormDialog taskTypes={taskTypes} onSuccess={onUpdated}>
          <Button size="sm" className="gap-1.5">
            <PlusIcon className="size-4" aria-hidden="true" />
            <span>Nowe zadanie</span>
          </Button>
        </TaskFormDialog>

        <Button
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={onPlan}
          className="gap-1.5"
        >
          {isPending ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <SparklesIcon className="size-4" aria-hidden="true" />
          )}
          <span>{isPending ? 'Planowanie...' : 'Zaplanuj'}</span>
        </Button>
      </div>
    </div>
  );
}

export function BacklogPanel({
  tasks,
  taskTypes,
  timeZone = 'Europe/Warsaw',
  onUpdated,
}: BacklogPanelProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = React.useTransition();
  const [plannerReport, setPlannerReport] = React.useState<RunPlannerResult | null>(null);

  React.useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const draggable = new Draggable(containerRef.current, {
      itemSelector: '.fc-backlog-task',
      eventData: (el) => ({
        id: el.getAttribute('data-task-id') ?? undefined,
        title: el.getAttribute('data-task-title') ?? '',
        duration: el.getAttribute('data-task-duration') ?? '01:30',
        create: false,
      }),
    });

    return () => {
      draggable.destroy();
    };
  }, [tasks]);

  const handlePlan = () => {
    startTransition(() => {
      const result = localRunPlanner(timeZone);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPlannerReport(result.data);
      if (result.data.unscheduled.length === 0) {
        toast.success(`Zaplanowano ${result.data.placed} bloków! Wszystko zmieściło się w planie.`);
      } else {
        toast.warning(
          `Zaplanowano ${result.data.placed} bloków, nie zmieściło się: ${result.data.unscheduled.length}`,
        );
      }
      onUpdated?.();
    });
  };

  return (
    <div className="space-y-4">
      <BacklogHeader
        count={tasks.length}
        taskTypes={taskTypes}
        isPending={isPending}
        onPlan={handlePlan}
        onUpdated={onUpdated}
      />

      {plannerReport && (
        <PlannerReportCard report={plannerReport} onDismiss={() => setPlannerReport(null)} />
      )}

      {tasks.length === 0 ? (
        <BacklogEmptyState />
      ) : (
        <div ref={containerRef} className="space-y-2">
          {tasks.map((task) => (
            <BacklogItem
              key={task.id}
              task={task}
              taskTypes={taskTypes}
              timeZone={timeZone}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
