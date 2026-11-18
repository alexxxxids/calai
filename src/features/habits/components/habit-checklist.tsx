'use client';

import * as React from 'react';
import { Flame, PlusIcon, Trash2Icon } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WEEKDAYS } from '@/features/recurring-events/components/recurring-events-helpers';
import {
  getLocalStoreVersion,
  localListHabitsForDay,
  localToggleHabit,
  subscribeLocalStore,
} from '@/lib/local-store';
import {
  ALL_HABIT_WEEKDAYS,
  localCreateHabit,
  localDeleteHabit,
} from '@/lib/local-store-habits';
import type { HabitForDay } from '@/lib/local-store-types';

const MAX_HABIT_NAME_LEN = 60;

interface HabitChecklistProps {
  readonly day: string;
}

function DeleteHabitConfirm({
  habit,
  onConfirm,
}: {
  readonly habit: HabitForDay;
  readonly onConfirm: (id: string) => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Usuń nawyk ${habit.name}`}
          className="size-7 text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon className="size-3.5" aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Usunąć nawyk?</AlertDialogTitle>
          <AlertDialogDescription>
            Czy na pewno chcesz usunąć nawyk „{habit.name}”? Historia jego wykonań zostanie usunięta.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => onConfirm(habit.id)}>
            Tak, usuń
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function HabitChecklistItem({
  habit,
  onToggle,
  onDelete,
}: {
  readonly habit: HabitForDay;
  readonly onToggle: (habitId: string, currentDone: boolean) => void;
  readonly onDelete: (habitId: string) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-accent/50">
      <div className="flex items-center gap-2.5 min-w-0">
        <Checkbox
          id={`habit-${habit.id}`}
          checked={habit.done}
          onCheckedChange={() => onToggle(habit.id, habit.done)}
        />
        <label
          htmlFor={`habit-${habit.id}`}
          className={`text-sm font-medium cursor-pointer truncate ${
            habit.done ? 'line-through text-muted-foreground' : 'text-foreground'
          }`}
        >
          {habit.name}
        </label>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {habit.streak > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
            title={`Seria: ${habit.streak} dni`}
          >
            <Flame className="h-3.5 w-3.5" />
            {habit.streak}
          </span>
        )}
        <DeleteHabitConfirm habit={habit} onConfirm={onDelete} />
      </div>
    </li>
  );
}

export function AddHabitDialog() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [weekdays, setWeekdays] = React.useState<readonly number[]>(ALL_HABIT_WEEKDAYS);

  const toggleDay = (dayVal: number) => {
    setWeekdays((prev) =>
      prev.includes(dayVal) ? prev.filter((d) => d !== dayVal) : [...prev, dayVal],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = localCreateHabit({ name, weekdays });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Dodano nawyk „${res.data.name}”`);
    setName('');
    setWeekdays(ALL_HABIT_WEEKDAYS);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
          <PlusIcon className="size-3.5" aria-hidden="true" />
          <span>Dodaj</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nowy nawyk</DialogTitle>
            <DialogDescription>Dodaj codzienny lub tygodniowy nawyk do śledzenia.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-habit-name">Nazwa nawyku</Label>
            <Input
              id="new-habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Medytacja 10 min"
              maxLength={MAX_HABIT_NAME_LEN}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Dni tygodnia</Label>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d) => {
                const active = weekdays.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    aria-pressed={active}
                    className={`h-8 rounded-md border text-xs font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:bg-accent'
                    }`}
                  >
                    {d.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
            <Button type="submit">Dodaj nawyk</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function HabitChecklist({ day }: HabitChecklistProps) {
  const storeVersion = React.useSyncExternalStore(
    subscribeLocalStore,
    getLocalStoreVersion,
    () => 0,
  );

  const habits = React.useMemo(() => {
    void storeVersion;
    return localListHabitsForDay(day);
  }, [day, storeVersion]);

  const handleToggle = (habitId: string, currentDone: boolean) => {
    localToggleHabit(habitId, day, !currentDone);
  };

  const handleDelete = (habitId: string) => {
    const res = localDeleteHabit(habitId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Usunięto nawyk');
  };

  if (habits.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        Brak zaplanowanych nawyków na ten dzień.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {habits.map((h) => (
        <HabitChecklistItem
          key={h.id}
          habit={h}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      ))}
    </ul>
  );
}
