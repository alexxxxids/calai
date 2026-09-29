'use client';

import * as React from 'react';
import type { Priority } from '@/domain/types';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FlexibleScheduleFields, HardScheduleFields, TaskFixationField } from './task-schedule-fields';
import {
  MAX_NOTES_LENGTH,
  NOTES_TEXTAREA_ROWS,
  PRIORITY_OPTIONS,
  type TaskFormData,
  type TaskFormErrors,
  type TaskTypeOption,
} from './task-form-types';
import { TaskTypeField } from './task-type-field';

interface TaskFormFieldsProps {
  readonly formData: TaskFormData;
  readonly taskTypes?: readonly TaskTypeOption[];
  readonly isEditing?: boolean;
  readonly errors?: TaskFormErrors;
  readonly pacePreview?: string | null;
  readonly onChange: <K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) => void;
}

export function TaskPriorityField({
  value,
  onChange,
}: {
  readonly value: Priority;
  readonly onChange: (val: Priority) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="taskPriority">Priorytet</Label>
      <Select
        value={String(value)}
        onValueChange={(val) => onChange(Number(val) as Priority)}
      >
        <SelectTrigger id="taskPriority" className="w-full">
          <SelectValue placeholder="Wybierz priorytet" />
        </SelectTrigger>
        <SelectContent position="popper">
          {PRIORITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function TaskNotesField({
  value,
  error,
  onChange,
}: {
  readonly value: string;
  readonly error?: string;
  readonly onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="taskNotes">Notatki (opcjonalnie)</Label>
      <Textarea
        id="taskNotes"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Opis zadania, materiały, wytyczne..."
        maxLength={MAX_NOTES_LENGTH}
        rows={NOTES_TEXTAREA_ROWS}
      />
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

export function TaskFormFields({
  formData,
  taskTypes = [],
  isEditing = false,
  errors,
  pacePreview,
  onChange,
}: TaskFormFieldsProps) {
  return (
    <div className="space-y-4 py-2">
      <TaskTypeField
        formData={formData}
        taskTypes={taskTypes}
        isEditing={isEditing}
        errors={errors}
        onChange={onChange}
      />

      <TaskFixationField formData={formData} isEditing={isEditing} onChange={onChange} />

      <TaskPriorityField
        value={formData.priority}
        onChange={(val) => onChange('priority', val)}
      />

      {formData.fixation === 'flexible' ? (
        <FlexibleScheduleFields
          formData={formData}
          errors={errors}
          pacePreview={pacePreview}
          onChange={onChange}
        />
      ) : (
        <HardScheduleFields formData={formData} errors={errors} onChange={onChange} />
      )}

      <TaskNotesField
        value={formData.notes}
        error={errors?.notes?.[0]}
        onChange={(val) => onChange('notes', val)}
      />
    </div>
  );
}
