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
import {
  MAX_TYPE_NAME_LENGTH,
  type TaskFormData,
  type TaskFormErrors,
  type TaskTypeOption,
} from './task-form-types';

interface TaskTypeFieldProps {
  readonly formData: TaskFormData;
  readonly taskTypes?: readonly TaskTypeOption[];
  readonly isEditing?: boolean;
  readonly errors?: TaskFormErrors;
  readonly onChange: <K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) => void;
}

function OneOffTypeInput({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Input
        id="newOneOffTypeName"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="np. Przygotowanie referatu z WOS-u"
        maxLength={MAX_TYPE_NAME_LENGTH}
        required
      />
      <p className="text-xs text-muted-foreground">
        Typ jednorazowy zostanie zarchiwizowany po ukończeniu lub anulowaniu zadania.
      </p>
    </div>
  );
}

function ExistingTypeSelect({
  value,
  types,
  onChange,
}: {
  readonly value: string;
  readonly types: readonly TaskTypeOption[];
  readonly onChange: (val: string) => void;
}) {
  const placeholder = types.length === 0 ? 'Brak typów' : 'Wybierz typ zadania';

  return (
    <Select value={value} onValueChange={onChange} disabled={types.length === 0}>
      <SelectTrigger id="taskTypeId" className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        {types.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <div className="flex items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                style={{ backgroundColor: t.color }}
                aria-hidden="true"
              />
              <span>{t.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TaskTypeHeader({
  isEditing,
  isOneOff,
  onToggle,
}: {
  readonly isEditing: boolean;
  readonly isOneOff: boolean;
  readonly onToggle: () => void;
}) {
  if (isEditing) {
    return <Label htmlFor="taskTypeId">Typ zadania</Label>;
  }

  return (
    <div className="flex items-center justify-between">
      <Label htmlFor="taskTypeId">Typ zadania</Label>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto p-0 text-xs text-primary underline-offset-4 hover:underline"
        onClick={onToggle}
      >
        {isOneOff ? 'Wybierz ze stałych typów' : '+ Nowy typ jednorazowy'}
      </Button>
    </div>
  );
}

function resolveTypeError(errors?: TaskFormErrors): string | null {
  if (!errors) {
    return null;
  }
  const byType = errors.typeId;
  if (byType && byType.length > 0) {
    return byType[0] ?? null;
  }
  const byOneOff = errors.newOneOffTypeName;
  if (byOneOff && byOneOff.length > 0) {
    return byOneOff[0] ?? null;
  }
  return null;
}

export function TaskTypeField({
  formData,
  taskTypes,
  isEditing,
  errors,
  onChange,
}: TaskTypeFieldProps) {
  const activeTypes = React.useMemo(() => {
    const list = taskTypes ?? [];
    return list.filter((t) => !t.is_rest);
  }, [taskTypes]);

  const typeError = resolveTypeError(errors);

  return (
    <div className="space-y-2">
      <TaskTypeHeader
        isEditing={Boolean(isEditing)}
        isOneOff={formData.isOneOff}
        onToggle={() => onChange('isOneOff', !formData.isOneOff)}
      />

      {formData.isOneOff ? (
        <OneOffTypeInput
          value={formData.newOneOffTypeName}
          onChange={(val) => onChange('newOneOffTypeName', val)}
        />
      ) : (
        <ExistingTypeSelect
          value={formData.typeId}
          types={activeTypes}
          onChange={(val) => onChange('typeId', val)}
        />
      )}

      {typeError && <p className="text-sm font-medium text-destructive">{typeError}</p>}
    </div>
  );
}
