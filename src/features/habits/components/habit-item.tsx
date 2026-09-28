'use client';

import * as React from 'react';
import { Pencil, Archive, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WEEKDAY_LABELS, ALL_WEEKDAYS } from '../schemas';
import type { HabitRow } from '../queries';

interface HabitItemProps {
  habit: HabitRow;
  onEdit: (habit: HabitRow) => void;
  onArchive: (habit: HabitRow, mode: 'archive' | 'unarchive' | 'delete') => void;
}

function WeekdayBadges({ activeDays }: { activeDays: number[] }) {
  const activeSet = new Set(activeDays);

  return (
    <div className="flex gap-1 flex-wrap">
      {ALL_WEEKDAYS.map((dayNum) => {
        const isActive = activeSet.has(dayNum);
        return (
          <span
            key={dayNum}
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              isActive
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground/40'
            }`}
          >
            {WEEKDAY_LABELS[dayNum]?.short}
          </span>
        );
      })}
    </div>
  );
}

export function HabitItem({ habit, onEdit, onArchive }: HabitItemProps) {
  const isArchived = habit.archived_at !== null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-sm">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-foreground ${isArchived ? 'line-through text-muted-foreground' : ''}`}>
            {habit.name}
          </span>
          {isArchived && <Badge variant="secondary">Zarchiwizowany</Badge>}
        </div>
        <WeekdayBadges activeDays={habit.weekdays} />
      </div>

      <div className="flex items-center gap-1 self-end sm:self-center">
        {!isArchived && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onEdit(habit)}
            aria-label="Edytuj nawyk"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}

        {isArchived ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onArchive(habit, 'unarchive')}
              aria-label="Przywróć nawyk"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onArchive(habit, 'delete')}
              aria-label="Usuń nawyk"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onArchive(habit, 'archive')}
            aria-label="Zarchiwizuj nawyk"
          >
            <Archive className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
