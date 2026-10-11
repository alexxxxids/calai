'use client';

import * as React from 'react';

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
import { instantToLocalDate } from '@/domain/time';

import { createRecurringEvents } from '../actions';
import { RECURRING_EVENT_TITLE_MAX_LENGTH } from '../schemas';
import {
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  DEFAULT_WARSAW_TIMEZONE,
  DEFAULT_WEEKDAY,
  submitRecurringEvent,
  WEEKDAYS,
} from './recurring-events-helpers';

export interface TaskTypeOption {
  readonly id: string;
  readonly name: string;
  readonly color: string;
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

function RecurringEventScheduleFields({
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

interface BasicFieldsProps {
  readonly typeId: string;
  readonly weekday: number;
  readonly taskTypes: readonly TaskTypeOption[];
  readonly onTypeChange: (val: string) => void;
  readonly onWeekdayChange: (val: number) => void;
}

function RecurringEventBasicFields({
  typeId,
  weekday,
  taskTypes,
  onTypeChange,
  onWeekdayChange,
}: BasicFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label htmlFor="rec-type">Typ zadania</Label>
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
      </div>

      <div className="space-y-1">
        <Label htmlFor="rec-weekday">Dzień tygodnia</Label>
        <Select value={String(weekday)} onValueChange={(v) => onWeekdayChange(Number(v))}>
          <SelectTrigger id="rec-weekday" className="w-full">
            <SelectValue placeholder="Wybierz dzień" />
          </SelectTrigger>
          <SelectContent position="popper">
            {WEEKDAYS.map((d) => (
              <SelectItem key={d.value} value={String(d.value)}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function RecurringEventForm({
  taskTypes,
  onCreated,
}: {
  readonly taskTypes: readonly TaskTypeOption[];
  readonly onCreated?: () => void;
}) {
  const [title, setTitle] = React.useState('');
  const [selectedTypeId, setSelectedTypeId] = React.useState('');
  const [weekday, setWeekday] = React.useState(DEFAULT_WEEKDAY);
  const [startTime, setStartTime] = React.useState(DEFAULT_START_TIME);
  const [endTime, setEndTime] = React.useState(DEFAULT_END_TIME);
  const [validFrom, setValidFrom] = React.useState(() =>
    instantToLocalDate(Date.now(), DEFAULT_WARSAW_TIMEZONE),
  );
  const [validUntil, setValidUntil] = React.useState('');
  const [isPending, startTransition] = React.useTransition();

  const effectiveTypeId = selectedTypeId || (taskTypes[0]?.id ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await submitRecurringEvent(
        {
          title,
          typeId: effectiveTypeId,
          weekday,
          startTime,
          endTime,
          validFrom,
          validUntil,
        },
        createRecurringEvents,
        () => {
          setTitle('');
          onCreated?.();
        },
      );
    });
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-sm font-semibold">Dodaj nowe zajęcia</h3>
      <div className="space-y-1">
        <Label htmlFor="rec-title">Nazwa zajęć</Label>
        <Input
          id="rec-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="np. Matematyka"
          maxLength={RECURRING_EVENT_TITLE_MAX_LENGTH}
          required
        />
      </div>

      <RecurringEventBasicFields
        typeId={effectiveTypeId}
        weekday={weekday}
        taskTypes={taskTypes}
        onTypeChange={setSelectedTypeId}
        onWeekdayChange={setWeekday}
      />

      <RecurringEventScheduleFields
        startTime={startTime}
        endTime={endTime}
        validFrom={validFrom}
        validUntil={validUntil}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
        onValidFromChange={setValidFrom}
        onValidUntilChange={setValidUntil}
      />

      <Button type="submit" disabled={isPending || taskTypes.length === 0} className="w-full">
        {isPending ? 'Dodawanie...' : 'Dodaj zajęcia'}
      </Button>
    </form>
  );
}
