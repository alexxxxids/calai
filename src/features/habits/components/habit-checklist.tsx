'use client';

import * as React from 'react';
import { Flame } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getLocalStoreVersion,
  localListHabitsForDay,
  localToggleHabit,
  subscribeLocalStore,
} from '@/lib/local-store';
import type { HabitForDay } from '@/lib/local-store-types';

interface HabitChecklistProps {
  readonly day: string;
}

function HabitChecklistItem({
  habit,
  onToggle,
}: {
  readonly habit: HabitForDay;
  readonly onToggle: (habitId: string, currentDone: boolean) => void;
}) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50">
      <div className="flex items-center gap-3">
        <Checkbox
          id={`habit-${habit.id}`}
          checked={habit.done}
          onCheckedChange={() => onToggle(habit.id, habit.done)}
        />
        <label
          htmlFor={`habit-${habit.id}`}
          className={`text-sm font-medium cursor-pointer ${
            habit.done ? 'line-through text-muted-foreground' : 'text-foreground'
          }`}
        >
          {habit.name}
        </label>
      </div>

      {habit.streak > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
          title={`Seria: ${habit.streak} dni z rzędu`}
        >
          <Flame className="h-3.5 w-3.5" />
          {habit.streak}
        </span>
      )}
    </li>
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

  if (habits.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Brak zaplanowanych nawyków na ten dzień.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {habits.map((h) => (
        <HabitChecklistItem key={h.id} habit={h} onToggle={handleToggle} />
      ))}
    </ul>
  );
}
