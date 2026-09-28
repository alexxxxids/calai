'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HabitItem } from './components/habit-item';
import { HabitDialog } from './components/habit-dialog';
import { ArchiveHabitDialog } from './components/archive-habit-dialog';
import { HabitChecklist } from './components/habit-checklist';
import type { HabitRow } from './queries';

interface HabitsClientProps {
  habits: HabitRow[];
  today: string;
}

function HabitsCatalogList({
  habits,
  onEdit,
  onArchive,
}: {
  habits: HabitRow[];
  onEdit: (habit: HabitRow) => void;
  onArchive: (habit: HabitRow, mode: 'archive' | 'unarchive' | 'delete') => void;
}) {
  if (habits.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
        Nie masz jeszcze żadnych aktywnych nawyków. Dodaj swój pierwszy nawyk, aby śledzić postępy!
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {habits.map((habit) => (
        <HabitItem
          key={habit.id}
          habit={habit}
          onEdit={onEdit}
          onArchive={onArchive}
        />
      ))}
    </div>
  );
}

function ArchivedSection({
  habits,
  onEdit,
  onArchive,
}: {
  habits: HabitRow[];
  onEdit: (habit: HabitRow) => void;
  onArchive: (habit: HabitRow, mode: 'archive' | 'unarchive' | 'delete') => void;
}) {
  if (habits.length === 0) return null;

  return (
    <section className="space-y-4 pt-4 border-t border-border">
      <h3 className="text-md font-semibold text-muted-foreground">
        Zarchiwizowane ({habits.length})
      </h3>
      <div className="grid gap-3 opacity-75">
        {habits.map((habit) => (
          <HabitItem
            key={habit.id}
            habit={habit}
            onEdit={onEdit}
            onArchive={onArchive}
          />
        ))}
      </div>
    </section>
  );
}

export function HabitsClient({ habits, today }: HabitsClientProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedHabit, setSelectedHabit] = React.useState<HabitRow | null>(null);

  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<HabitRow | null>(null);
  const [archiveMode, setArchiveMode] = React.useState<'archive' | 'unarchive' | 'delete'>('archive');

  const activeHabits = habits.filter((h) => h.archived_at === null);
  const archivedHabits = habits.filter((h) => h.archived_at !== null);

  const handleCreate = () => {
    setSelectedHabit(null);
    setDialogOpen(true);
  };

  const handleEdit = (habit: HabitRow) => {
    setSelectedHabit(habit);
    setDialogOpen(true);
  };

  const handleArchive = (habit: HabitRow, mode: 'archive' | 'unarchive' | 'delete') => {
    setArchiveTarget(habit);
    setArchiveMode(mode);
    setArchiveOpen(true);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-card/60 p-6 shadow-xs">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Dzisiejsze nawyki ({today})
        </h2>
        <HabitChecklist day={today} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Wszystkie nawyki</h2>
            <p className="text-sm text-muted-foreground">
              Zarządzaj stałymi rytuałami i dniami ich powtarzania.
            </p>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nowy nawyk
          </Button>
        </div>

        <HabitsCatalogList
          habits={activeHabits}
          onEdit={handleEdit}
          onArchive={handleArchive}
        />
      </section>

      <ArchivedSection
        habits={archivedHabits}
        onEdit={handleEdit}
        onArchive={handleArchive}
      />

      <HabitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        habit={selectedHabit}
      />

      <ArchiveHabitDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        habit={archiveTarget}
        mode={archiveMode}
      />
    </div>
  );
}
