'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  EVENT_TITLE_MAX,
  MAX_TOPIC_WORK_MINUTES,
  MIN_TOPIC_WORK_MINUTES_DRAFT,
  type TimetableEvent,
} from '@/features/ai/schemas';

export const WORK_MINUTES_STEP = 5;

const BYTES_PER_KIBIBYTE = 1024;
const KIBIBYTES_PER_MEBIBYTE = 1024;
const BYTES_PER_MEGABYTE = BYTES_PER_KIBIBYTE * KIBIBYTES_PER_MEBIBYTE;
const DECIMAL_PLACES_ONE = 1;

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Pn' },
  { value: 2, label: 'Wt' },
  { value: 3, label: 'Śr' },
  { value: 4, label: 'Czw' },
  { value: 5, label: 'Pt' },
  { value: 6, label: 'Sob' },
  { value: 7, label: 'Nd' },
] as const;

export function formatFileSize(bytes: number): string {
  return `${(bytes / BYTES_PER_MEGABYTE).toFixed(DECIMAL_PLACES_ONE)} MB`;
}

export interface DecomposeTopicRowProps {
  index: number;
  title: string;
  workMinutes: number;
  canRemove: boolean;
  onTitleChange: (title: string) => void;
  onMinutesChange: (minutes: number) => void;
  onRemove: () => void;
}

export function DecomposeTopicRow({
  index,
  title,
  workMinutes,
  canRemove,
  onTitleChange,
  onMinutesChange,
  onRemove,
}: DecomposeTopicRowProps) {
  return (
    <div className="flex items-center gap-2" data-slot="decompose-topic-row">
      <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{index + 1}.</span>
      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Nazwa tematu"
        className="flex-1 text-xs"
      />
      <div className="flex items-center gap-1 shrink-0">
        <Input
          type="number"
          min={MIN_TOPIC_WORK_MINUTES_DRAFT}
          max={MAX_TOPIC_WORK_MINUTES}
          step={WORK_MINUTES_STEP}
          value={workMinutes}
          onChange={(e) => onMinutesChange(Number(e.target.value))}
          className="w-16 text-right text-xs"
        />
        <span className="text-xs text-muted-foreground">min</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        disabled={!canRemove}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        title="Usuń temat"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

export interface TimetableEventRowProps {
  event: TimetableEvent;
  canRemove: boolean;
  onTitleChange: (title: string) => void;
  onWeekdayChange: (weekday: number) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onRemove: () => void;
}

export function TimetableEventRow({
  event,
  canRemove,
  onTitleChange,
  onWeekdayChange,
  onStartTimeChange,
  onEndTimeChange,
  onRemove,
}: TimetableEventRowProps) {
  return (
    <div className="flex items-center gap-2" data-slot="timetable-event-row">
      <select
        value={event.weekday}
        onChange={(e) => onWeekdayChange(Number(e.target.value))}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none shrink-0"
      >
        {WEEKDAY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <Input
        value={event.title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Przedmiot"
        maxLength={EVENT_TITLE_MAX}
        className="flex-1 text-xs"
      />
      <Input
        type="time"
        value={event.startTime}
        onChange={(e) => onStartTimeChange(e.target.value)}
        className="w-20 text-xs shrink-0"
      />
      <span className="text-xs text-muted-foreground shrink-0">–</span>
      <Input
        type="time"
        value={event.endTime}
        onChange={(e) => onEndTimeChange(e.target.value)}
        className="w-20 text-xs shrink-0"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        disabled={!canRemove}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        title="Usuń zajęcia"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
