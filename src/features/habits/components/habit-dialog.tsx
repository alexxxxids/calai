'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  WEEKDAY_LABELS,
  ALL_WEEKDAYS,
  MAX_HABIT_NAME_LENGTH,
} from '../schemas';
import { createHabit, updateHabit } from '../actions';
import type { HabitRow } from '../queries';

interface HabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit?: HabitRow | null;
}

function WeekdaySelector({
  value,
  onChange,
}: {
  value: string[];
  onChange: (val: string[]) => void;
}) {
  const setAll = () => onChange(ALL_WEEKDAYS.map(String));
  const setWorkdays = () => onChange(['1', '2', '3', '4', '5']);
  const setWeekend = () => onChange(['6', '7']);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Dni tygodnia</label>
        <div className="flex gap-1 text-xs">
          <button
            type="button"
            onClick={setAll}
            className="text-primary hover:underline"
          >
            Wszystkie
          </button>
          <span className="text-muted-foreground">•</span>
          <button
            type="button"
            onClick={setWorkdays}
            className="text-primary hover:underline"
          >
            Robocze
          </button>
          <span className="text-muted-foreground">•</span>
          <button
            type="button"
            onClick={setWeekend}
            className="text-primary hover:underline"
          >
            Weekend
          </button>
        </div>
      </div>

      <ToggleGroup
        type="multiple"
        value={value}
        onValueChange={onChange}
        className="justify-between w-full"
      >
        {ALL_WEEKDAYS.map((dayNum) => (
          <ToggleGroupItem
            key={dayNum}
            value={String(dayNum)}
            aria-label={WEEKDAY_LABELS[dayNum]?.full}
            className="flex-1 text-xs font-semibold"
          >
            {WEEKDAY_LABELS[dayNum]?.short}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function HabitForm({
  habit,
  onDone,
}: {
  habit?: HabitRow | null;
  onDone: () => void;
}) {
  const [name, setName] = React.useState(habit?.name ?? '');
  const [weekdays, setWeekdays] = React.useState<string[]>(
    habit?.weekdays?.map(String) ?? ALL_WEEKDAYS.map(String),
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (weekdays.length === 0) {
      setError('Wybierz co najmniej jeden dzień tygodnia');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('name', name);
    for (const d of weekdays) {
      formData.append('weekdays', d);
    }

    try {
      let res;
      if (habit) {
        formData.append('id', habit.id);
        res = await updateHabit({ status: 'idle' }, formData);
      } else {
        res = await createHabit({ status: 'idle' }, formData);
      }

      if (res.status === 'error') {
        setError(res.message ?? 'Wystąpił błąd');
      } else {
        toast.success(res.message);
        onDone();
      }
    } catch {
      setError('Wystąpił nieoczekiwany błąd');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="habit-name" className="text-sm font-medium text-foreground">
          Nazwa nawyku
        </label>
        <Input
          id="habit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="np. Poranny spacer, Czytanie książki"
          maxLength={MAX_HABIT_NAME_LENGTH}
          required
        />
      </div>

      <WeekdaySelector value={weekdays} onChange={setWeekdays} />

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={loading}>
          Anuluj
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Zapisywanie...' : habit ? 'Zapisz zmiany' : 'Dodaj nawyk'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function HabitDialog({ open, onOpenChange, habit }: HabitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{habit ? 'Edytuj nawyk' : 'Nowy nawyk'}</DialogTitle>
        </DialogHeader>
        <HabitForm
          key={habit?.id ?? 'new'}
          habit={habit}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
