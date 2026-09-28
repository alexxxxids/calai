'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { archiveHabit, unarchiveHabit, deleteHabit } from '../actions';
import type { HabitRow } from '../queries';

interface ArchiveHabitDialogProps {
  habit: HabitRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'archive' | 'unarchive' | 'delete';
}

export function ArchiveHabitDialog({
  habit,
  open,
  onOpenChange,
  mode,
}: ArchiveHabitDialogProps) {
  const [loading, setLoading] = React.useState(false);

  if (!habit) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      let res;
      if (mode === 'archive') {
        res = await archiveHabit(habit.id);
      } else if (mode === 'unarchive') {
        res = await unarchiveHabit(habit.id);
      } else {
        res = await deleteHabit(habit.id);
      }

      if (res.status === 'error') {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        onOpenChange(false);
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    archive: 'Zarchiwizować nawyk?',
    unarchive: 'Przywrócić nawyk?',
    delete: 'Trwale usunąć nawyk?',
  };

  const descriptions = {
    archive: `Nawyk "${habit.name}" przestanie pojawiać się w codziennym planerze, ale historia oznaczeń zostanie zachowana.`,
    unarchive: `Nawyk "${habit.name}" powróci do aktywnej listy i codziennego planera.`,
    delete: `Nawyk "${habit.name}" i cała jego historia oznaczeń zostaną trwale usunięte. Tej operacji nie można cofnąć.`,
  };

  const buttonText = {
    archive: 'Zarchiwizuj',
    unarchive: 'Przywróć',
    delete: 'Usuń trwale',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titles[mode]}</DialogTitle>
          <DialogDescription>{descriptions[mode]}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Anuluj
          </Button>
          <Button
            variant={mode === 'unarchive' ? 'default' : 'destructive'}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Przetwarzanie...' : buttonText[mode]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
