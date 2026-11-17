'use client';

import * as React from 'react';
import { Draggable } from '@fullcalendar/react/interaction';
import { InboxIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  onUpdated,
}: {
  readonly count: number;
  readonly taskTypes?: readonly TaskTypeOption[];
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

      <TaskFormDialog taskTypes={taskTypes} onSuccess={onUpdated}>
        <Button size="sm" className="gap-1.5">
          <PlusIcon className="size-4" aria-hidden="true" />
          <span>Nowe zadanie</span>
        </Button>
      </TaskFormDialog>
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

  return (
    <div className="space-y-4">
      <BacklogHeader count={tasks.length} taskTypes={taskTypes} onUpdated={onUpdated} />

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
