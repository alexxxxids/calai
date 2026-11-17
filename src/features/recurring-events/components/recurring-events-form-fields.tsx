'use client';

import * as React from 'react';
import { TagsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TaskTypesManager } from '@/features/task-types/components/task-types-manager';
import { RECURRING_EVENT_TITLE_MAX_LENGTH } from '../schemas';
import { WEEKDAYS } from './recurring-events-helpers';

export function RecurringEventTitleField({
  title,
  onTitleChange,
}: {
  readonly title: string;
  readonly onTitleChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor="rec-title">Nazwa zajęć</Label>
      <Input
        id="rec-title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="np. Matematyka"
        maxLength={RECURRING_EVENT_TITLE_MAX_LENGTH}
        required
      />
    </div>
  );
}

export interface TaskTypeOption {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly energy?: number;
}

interface ScheduleFieldsProps {
  readonly startTime: string;
  readonly endTime: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly onStartTimeChange: (val: string) => void;
  readonly onEndTimeChange: (val: string) => void;
  readonly onValidFromChange: (val: string) => void;
  readonly onValidUntilChange: (val: string) => void;
}

export function RecurringEventScheduleFields({
  startTime,
  endTime,
  validFrom,
  validUntil,
  onStartTimeChange,
  onEndTimeChange,
  onValidFromChange,
  onValidUntilChange,
}: ScheduleFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="rec-start-time">Początek</Label>
          <Input
            id="rec-start-time"
            type="time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rec-end-time">Koniec</Label>
          <Input
            id="rec-end-time"
            type="time"
            value={endTime}
            onChange={(e) => onEndTimeChange(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="rec-valid-from">Obowiązuje od</Label>
          <Input
            id="rec-valid-from"
            type="date"
            value={validFrom}
            onChange={(e) => onValidFromChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rec-valid-until">Obowiązuje do (opcjonalnie)</Label>
          <Input
            id="rec-valid-until"
            type="date"
            value={validUntil}
            onChange={(e) => onValidUntilChange(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}

export function WeekdayMultiPicker({
  selectedDays,
  onToggleDay,
  onSelectWorkWeek,
}: {
  readonly selectedDays: readonly number[];
  readonly onToggleDay: (day: number) => void;
  readonly onSelectWorkWeek: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>Dni tygodnia (można wybrać kilka)</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSelectWorkWeek}
          className="h-auto p-0 text-xs text-primary hover:underline"
        >
          Pn–Pt
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Wybierz dni tygodnia">
        {WEEKDAYS.map((day) => {
          const active = selectedDays.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              onClick={() => onToggleDay(day.value)}
              aria-pressed={active}
              title={day.label}
              className={`h-8 rounded-md border text-xs font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-accent'
              }`}
            >
              {day.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TypeSelectorWithManager({
  typeId,
  taskTypes,
  showManager,
  onToggleManager,
  onTypeChange,
}: {
  readonly typeId: string;
  readonly taskTypes: readonly TaskTypeOption[];
  readonly showManager: boolean;
  readonly onToggleManager: () => void;
  readonly onTypeChange: (val: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="rec-type">Typ zadania</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleManager}
          className="h-auto gap-1 p-0 text-xs text-primary hover:underline"
        >
          <TagsIcon className="size-3" aria-hidden="true" />
          <span>{showManager ? 'Ukryj typy' : 'Dodaj / usuń typy'}</span>
        </Button>
      </div>
      <Select value={typeId} onValueChange={onTypeChange} disabled={taskTypes.length === 0}>
        <SelectTrigger id="rec-type" className="w-full">
          <SelectValue placeholder="Wybierz typ" />
        </SelectTrigger>
        <SelectContent position="popper">
          {taskTypes.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full border border-black/10 dark:border-white/10"
                  style={{ backgroundColor: t.color }}
                  aria-hidden="true"
                />
                <span>{t.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showManager && (
        <div className="rounded-lg border border-border bg-background p-2.5">
          <TaskTypesManager
            taskTypes={taskTypes}
            onCreated={(createdId) => onTypeChange(createdId)}
            onDeleted={(deletedId) => {
              if (typeId === deletedId) {
                onTypeChange('');
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
