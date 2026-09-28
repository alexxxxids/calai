'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  ENERGY_LEVEL_LABELS,
  MAX_TASK_TYPE_NAME_LENGTH,
} from '@/features/task-types/schemas';
import { createTaskType, updateTaskType } from '@/features/task-types/actions';
import type { TaskTypeRow } from '@/features/task-types/queries';

const DEFAULT_COLOR = '#3b82f6';
const DEFAULT_ENERGY = 2;

function getInitialFormState(data?: TaskTypeRow) {
  if (!data) {
    return { name: '', color: DEFAULT_COLOR, energy: DEFAULT_ENERGY, isRest: false };
  }
  return { name: data.name, color: data.color, energy: data.energy, isRest: data.is_rest };
}

async function submitTaskType(
  id: string | undefined,
  payload: { name: string; color: string; energy: number }
) {
  if (id) {
    return updateTaskType({ id, ...payload });
  }
  return createTaskType(payload);
}

interface TaskTypeFieldsProps {
  readonly name: string;
  readonly color: string;
  readonly energy: number;
  readonly isRest: boolean;
  readonly nameError: string | null;
  readonly onNameChange: (val: string) => void;
  readonly onColorChange: (val: string) => void;
  readonly onEnergyChange: (val: number) => void;
}

function TaskTypeFields({
  name,
  color,
  energy,
  isRest,
  nameError,
  onNameChange,
  onColorChange,
  onEnergyChange,
}: TaskTypeFieldsProps) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="typeName">Nazwa typu</Label>
        <Input
          id="typeName"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="np. Matematyka"
          required
          maxLength={MAX_TASK_TYPE_NAME_LENGTH}
        />
        {nameError && (
          <p className="text-sm font-medium text-destructive">{nameError}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="typeColor">Kolor w kalendarzu</Label>
        <div className="flex items-center gap-3">
          <input
            id="typeColor"
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="size-10 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
          />
          <Input
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="font-mono text-sm uppercase"
            maxLength={7}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="typeEnergy">Poziom obciążenia energią</Label>
        <Select
          value={String(energy)}
          onValueChange={(val) => onEnergyChange(Number(val))}
          disabled={isRest}
        >
          <SelectTrigger id="typeEnergy" className="w-full">
            <SelectValue placeholder="Wybierz poziom energii" />
          </SelectTrigger>
          <SelectContent position="popper">
            {Object.entries(ENERGY_LEVEL_LABELS).map(([level, label]) => (
              <SelectItem key={level} value={level}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isRest && (
          <p className="text-xs text-muted-foreground">
            Systemowy typ odpoczynku ma zawsze poziom regeneracji (0 pkt).
          </p>
        )}
      </div>
    </div>
  );
}

interface TaskTypeFormProps {
  readonly initialData?: TaskTypeRow;
  readonly onSuccess: () => void;
  readonly onCancel: () => void;
}

export function TaskTypeForm({ initialData, onSuccess, onCancel }: TaskTypeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [formState, setFormState] = React.useState(() => getInitialFormState(initialData));
  const [nameError, setNameError] = React.useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);

    startTransition(async () => {
      const result = await submitTaskType(initialData?.id, formState);

      if (!result.ok) {
        const fieldErr = result.fieldErrors?.name?.[0];
        if (fieldErr) {
          setNameError(fieldErr);
        } else {
          toast.error(result.error);
        }
        return;
      }

      toast.success(initialData ? 'Zaktualizowano typ zadania' : 'Utworzono typ zadania');
      router.refresh();
      onSuccess();
    });
  };

  const titleText = initialData ? 'Edytuj typ zadania' : 'Nowy typ zadania';
  const submitText = initialData ? 'Zapisz zmiany' : 'Utwórz typ';

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{titleText}</DialogTitle>
        <DialogDescription>
          Zdefiniuj nazwę, kolor w kalendarzu oraz poziom energii mentalnej.
        </DialogDescription>
      </DialogHeader>

      <TaskTypeFields
        name={formState.name}
        color={formState.color}
        energy={formState.energy}
        isRest={formState.isRest}
        nameError={nameError}
        onNameChange={(val) => setFormState((prev) => ({ ...prev, name: val }))}
        onColorChange={(val) => setFormState((prev) => ({ ...prev, color: val }))}
        onEnergyChange={(val) => setFormState((prev) => ({ ...prev, energy: val }))}
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Anuluj
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Zapisywanie...' : submitText}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface TaskTypeDialogProps {
  readonly initialData?: TaskTypeRow;
  readonly children: React.ReactNode;
}

export function TaskTypeDialog({ initialData, children }: TaskTypeDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {open && (
          <TaskTypeForm
            key={initialData?.id ?? 'new'}
            initialData={initialData}
            onSuccess={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
