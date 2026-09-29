'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ESTIMATE_STEP_MINUTES,
  HARD_DURATION_STEP_MINUTES,
  MAX_ESTIMATE_MINUTES,
  MAX_HARD_DURATION_MINUTES,
  MIN_ESTIMATE_MINUTES,
  MIN_HARD_DURATION_MINUTES,
  SESSION_OPTIONS,
  type TaskFormData,
  type TaskFormErrors,
} from './task-form-types';

interface ScheduleFieldProps {
  readonly formData: TaskFormData;
  readonly errors?: TaskFormErrors;
  readonly onChange: <K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) => void;
}

export function TaskFixationField({
  formData,
  isEditing = false,
  onChange,
}: {
  readonly formData: TaskFormData;
  readonly isEditing?: boolean;
  readonly onChange: <K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) => void;
}) {
  if (isEditing) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label>Tryb planowania</Label>
      <RadioGroup
        value={formData.fixation}
        onValueChange={(val) => onChange('fixation', val as 'flexible' | 'hard')}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <label
          htmlFor="fixation-flexible"
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
        >
          <RadioGroupItem value="flexible" id="fixation-flexible" className="mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-sm font-medium text-foreground">Elastyczne</span>
            <p className="text-xs text-muted-foreground">Automatyczny dobór okien w kalendarzu</p>
          </div>
        </label>
        <label
          htmlFor="fixation-hard"
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
        >
          <RadioGroupItem value="hard" id="fixation-hard" className="mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-sm font-medium text-foreground">Sztywne</span>
            <p className="text-xs text-muted-foreground">Konkretny termin i godzina w planie</p>
          </div>
        </label>
      </RadioGroup>
    </div>
  );
}

function EstimateInputSection({
  estimateMinutes,
  pacePreview,
  error,
  onChange,
}: {
  readonly estimateMinutes: string;
  readonly pacePreview?: string | null;
  readonly error?: string;
  readonly onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="estimateMinutes">Szacowany czas (minuty, opcjonalnie)</Label>
      <Input
        id="estimateMinutes"
        type="number"
        min={MIN_ESTIMATE_MINUTES}
        max={MAX_ESTIMATE_MINUTES}
        step={ESTIMATE_STEP_MINUTES}
        value={estimateMinutes}
        onChange={(e) => onChange(e.target.value)}
        placeholder="np. 90 (puste = pomysł w backlogu)"
      />
      {pacePreview && (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
          {pacePreview}
        </div>
      )}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

function DeadlineInputSection({
  date,
  time,
  error,
  onDateChange,
  onTimeChange,
}: {
  readonly date: string;
  readonly time: string;
  readonly error?: string;
  readonly onDateChange: (val: string) => void;
  readonly onTimeChange: (val: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Termin ostateczny (deadline, opcjonalnie)</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          aria-label="Data deadline"
        />
        <Input
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          aria-label="Godzina deadline"
        />
      </div>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

export function FlexibleScheduleFields({
  formData,
  errors,
  pacePreview,
  onChange,
}: ScheduleFieldProps & { readonly pacePreview?: string | null }) {
  const estimateErr = errors?.estimateMinutes?.[0];
  const deadlineErr = errors?.deadlineDate?.[0] ?? errors?.deadlineTime?.[0];

  return (
    <div className="space-y-4">
      <EstimateInputSection
        estimateMinutes={formData.estimateMinutes}
        pacePreview={pacePreview}
        error={estimateErr}
        onChange={(val) => onChange('estimateMinutes', val)}
      />

      <div className="space-y-2">
        <Label htmlFor="sessionMinutes">Długość pojedynczej sesji (opcjonalnie)</Label>
        <Select
          value={formData.sessionMinutes}
          onValueChange={(val) => onChange('sessionMinutes', val)}
        >
          <SelectTrigger id="sessionMinutes" className="w-full">
            <SelectValue placeholder="Domyślna (90 min)" />
          </SelectTrigger>
          <SelectContent position="popper">
            {SESSION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || 'default'} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DeadlineInputSection
        date={formData.deadlineDate}
        time={formData.deadlineTime}
        error={deadlineErr}
        onDateChange={(val) => onChange('deadlineDate', val)}
        onTimeChange={(val) => onChange('deadlineTime', val)}
      />
    </div>
  );
}

export function HardScheduleFields({ formData, errors, onChange }: ScheduleFieldProps) {
  const hardErr = errors?.date?.[0] ?? errors?.startTime?.[0] ?? errors?.durationMinutes?.[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="hardDate">Data</Label>
          <Input
            id="hardDate"
            type="date"
            value={formData.hardDate}
            onChange={(e) => onChange('hardDate', e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hardStartTime">Godzina rozpoczęcia</Label>
          <Input
            id="hardStartTime"
            type="time"
            value={formData.hardStartTime}
            onChange={(e) => onChange('hardStartTime', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hardDurationMinutes">Czas trwania (minuty)</Label>
        <Input
          id="hardDurationMinutes"
          type="number"
          min={MIN_HARD_DURATION_MINUTES}
          max={MAX_HARD_DURATION_MINUTES}
          step={HARD_DURATION_STEP_MINUTES}
          value={formData.hardDurationMinutes}
          onChange={(e) => onChange('hardDurationMinutes', e.target.value)}
          required
        />
      </div>

      {hardErr && <p className="text-sm font-medium text-destructive">{hardErr}</p>}
    </div>
  );
}
