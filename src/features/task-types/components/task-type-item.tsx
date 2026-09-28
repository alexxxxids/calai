'use client';

import { ArchiveIcon, PencilIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ENERGY_LEVEL_LABELS } from '@/features/task-types/schemas';
import type { TaskTypeRow } from '@/features/task-types/queries';
import { TaskTypeDialog } from './task-type-dialog';
import { ArchiveTypeDialog } from './archive-type-dialog';

interface TaskTypeItemProps {
  readonly taskType: TaskTypeRow;
}

export function TaskTypeItem({ taskType }: TaskTypeItemProps) {
  const energyLabel = ENERGY_LEVEL_LABELS[taskType.energy] ?? 'Średnie';

  return (
    <div className="flex items-center justify-between p-4 transition-colors hover:bg-muted/40">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="size-4 shrink-0 rounded-full border border-black/10 dark:border-white/10"
          style={{ backgroundColor: taskType.color }}
          aria-hidden="true"
        />
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-semibold text-foreground truncate">
            {taskType.name}
          </span>
          {taskType.is_rest ? (
            <Badge variant="secondary" className="text-xs">
              Odpoczynek
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {energyLabel}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-4">
        <TaskTypeDialog initialData={taskType}>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={`Edytuj typ ${taskType.name}`}
          >
            <PencilIcon className="size-4" aria-hidden="true" />
          </Button>
        </TaskTypeDialog>

        {!taskType.is_rest && (
          <ArchiveTypeDialog id={taskType.id} name={taskType.name}>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              aria-label={`Zarchiwizuj typ ${taskType.name}`}
            >
              <ArchiveIcon className="size-4" aria-hidden="true" />
            </Button>
          </ArchiveTypeDialog>
        )}
      </div>
    </div>
  );
}
