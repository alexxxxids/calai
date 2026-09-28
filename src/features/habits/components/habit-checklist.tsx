'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Flame, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { HabitForDay } from '../queries';

interface HabitChecklistProps {
  day: string;
}

function HabitChecklistItem({
  habit,
  onToggle,
}: {
  habit: HabitForDay;
  onToggle: (habitId: string, currentDone: boolean) => void;
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

function HabitChecklistState({
  loading,
  empty,
}: {
  loading: boolean;
  empty: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (empty) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Brak zaplanowanych nawyków na ten dzień.
      </div>
    );
  }
  return null;
}

export function HabitChecklist({ day }: HabitChecklistProps) {
  const [habits, setHabits] = React.useState<HabitForDay[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/habits?day=${day}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { habits: HabitForDay[] };
        if (!ignore) setHabits(data.habits ?? []);
      } catch {
        if (!ignore) toast.error('Nie udało się załadować nawyków');
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => { ignore = true; };
  }, [day]);

  const handleToggle = async (habitId: string, currentDone: boolean) => {
    const nextDone = !currentDone;
    const prev = habits;
    setHabits((curr) =>
      curr.map((h) =>
        h.id === habitId
          ? { ...h, done: nextDone, streak: nextDone ? h.streak + 1 : Math.max(0, h.streak - 1) }
          : h,
      ),
    );

    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId, day, done: nextDone }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setHabits(prev);
      toast.error('Nie udało się zaktualizować nawyku');
    }
  };

  if (loading || habits.length === 0) {
    return <HabitChecklistState loading={loading} empty={habits.length === 0} />;
  }

  return (
    <ul className="space-y-2">
      {habits.map((h) => (
        <HabitChecklistItem key={h.id} habit={h} onToggle={handleToggle} />
      ))}
    </ul>
  );
}
