'use client';

import * as React from 'react';
import { TagsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TaskTypesManager, type ManageableTaskType } from './task-types-manager';

interface TaskTypesDialogProps {
  readonly taskTypes: readonly ManageableTaskType[];
  readonly triggerLabel?: string;
}

export function TaskTypesDialog({
  taskTypes,
  triggerLabel = 'Typy zadań',
}: TaskTypesDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
          <TagsIcon className="size-3.5" aria-hidden="true" />
          <span>{triggerLabel}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zarządzaj typami zadań</DialogTitle>
          <DialogDescription>
            Twórz własne kategorie zadań i zajęć albo usuwaj niepotrzebne typy.
          </DialogDescription>
        </DialogHeader>

        <TaskTypesManager taskTypes={taskTypes} />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Zamknij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
