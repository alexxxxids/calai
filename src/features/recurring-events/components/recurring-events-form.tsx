'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { instantToLocalDate } from '@/domain/time';
import { localCreateRecurringEvents } from '@/lib/local-store';
import type { CreateRecurringEventsInput } from '../types';
import {
  RecurringEventScheduleFields,
  RecurringEventTitleField,
  TypeSelectorWithManager,
  WeekdayMultiPicker,
  type TaskTypeOption,
} from './recurring-events-form-fields';
import {
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  DEFAULT_WARSAW_TIMEZONE,
  DEFAULT_WEEKDAY,
  submitRecurringEvent,
  WORK_WEEKDAYS,
} from './recurring-events-helpers';

export type { TaskTypeOption };

export interface RecurringEventFormProps {
  readonly taskTypes: readonly TaskTypeOption[];
  readonly onCreated?: () => void;
  readonly timeZone?: string;
  readonly isSubmitting?: boolean;
  readonly onSubmittingChange?: (submitting: boolean) => void;
}

export function RecurringEventForm({
  taskTypes,
  onCreated,
  timeZone = DEFAULT_WARSAW_TIMEZONE,
  isSubmitting: controlledIsSubmitting,
  onSubmittingChange,
}: RecurringEventFormProps) {
  const [title, setTitle] = React.useState('');
  const [selectedTypeId, setSelectedTypeId] = React.useState('');
  const [showTypeManager, setShowTypeManager] = React.useState(false);
  const [weekdays, setWeekdays] = React.useState<readonly number[]>([DEFAULT_WEEKDAY]);
  const [startTime, setStartTime] = React.useState(DEFAULT_START_TIME);
  const [endTime, setEndTime] = React.useState(DEFAULT_END_TIME);
  const [validFrom, setValidFrom] = React.useState(() => instantToLocalDate(Date.now(), timeZone));
  const [validUntil, setValidUntil] = React.useState('');
  const [internalPending, startTransition] = React.useTransition();

  const isPending = controlledIsSubmitting ?? internalPending;
  const effectiveTypeId =
    taskTypes.some((t) => t.id === selectedTypeId) ? selectedTypeId : (taskTypes[0]?.id ?? '');

  const handleToggleDay = (day: number) => {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmittingChange?.(true);
    startTransition(async () => {
      try {
        await submitRecurringEvent(
          { title, typeId: effectiveTypeId, weekdays, startTime, endTime, validFrom, validUntil },
          async (input) => localCreateRecurringEvents(input as CreateRecurringEventsInput),
          () => {
            setTitle('');
            onCreated?.();
          },
        );
      } finally {
        onSubmittingChange?.(false);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-sm font-semibold">Dodaj nowe zajęcia</h3>
      <RecurringEventTitleField title={title} onTitleChange={setTitle} />
      <TypeSelectorWithManager
        typeId={effectiveTypeId}
        taskTypes={taskTypes}
        showManager={showTypeManager}
        onToggleManager={() => setShowTypeManager((v) => !v)}
        onTypeChange={setSelectedTypeId}
      />
      <WeekdayMultiPicker
        selectedDays={weekdays}
        onToggleDay={handleToggleDay}
        onSelectWorkWeek={() => setWeekdays(WORK_WEEKDAYS)}
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
        {isPending ? 'Dodawanie...' : `Dodaj zajęcia (${weekdays.length})`}
      </Button>
    </form>
  );
}
