'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { archiveTaskType } from '@/features/task-types/actions';

interface ArchiveTypeDialogProps {
  readonly id: string;
  readonly name: string;
  readonly children: React.ReactNode;
}

export function ArchiveTypeDialog({
  id,
  name,
  children,
}: ArchiveTypeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const handleArchive = () => {
    startTransition(async () => {
      const result = await archiveTaskType({ id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Typ «${name}» został zarchiwizowany`);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Zarchiwizować typ zadania?</AlertDialogTitle>
          <AlertDialogDescription>
            Typ «{name}» zostanie ukryty na liście wyboru dla nowych zadań.
            Wszystkie dotychczasowe zadania i statystyki zachowają ten typ.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Anuluj</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleArchive}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Archiwizowanie...' : 'Zarchiwizuj'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
