'use client';

import * as React from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  countTaskTypeUsage,
  localCreateTaskType,
  localDeleteTaskType,
} from '@/lib/local-store-task-types';
import { ENERGY_LEVEL_LABELS, MAX_TASK_TYPE_NAME_LENGTH } from '../schemas';

const PRESET_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#10b981',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#06b6d4',
  '#64748b',
] as const;

const DEFAULT_COLOR = '#3b82f6';
const DEFAULT_ENERGY = '2';

export interface ManageableTaskType {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly energy?: number;
}

interface TaskTypesManagerProps {
  readonly taskTypes: readonly ManageableTaskType[];
  readonly onCreated?: (createdId: string) => void;
  readonly onDeleted?: (deletedId: string) => void;
}

function ColorSwatchPicker({
  color,
  onChange,
}: {
  readonly color: string;
  readonly onChange: (nextColor: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESET_COLORS.map((hex) => (
        <button
          key={hex}
          type="button"
          onClick={() => onChange(hex)}
          aria-label={`Kolor ${hex}`}
          className={`size-6 rounded-full border transition-transform ${
            color === hex ? 'scale-110 ring-2 ring-primary ring-offset-2' : 'border-black/15'
          }`}
          style={{ backgroundColor: hex }}
        />
      ))}
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Własny kolor"
        className="size-6 cursor-pointer rounded border border-border bg-transparent p-0"
      />
    </div>
  );
}

function NewTypeFormCard({
  onCreated,
}: {
  readonly onCreated?: (createdId: string) => void;
}) {
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState<string>(DEFAULT_COLOR);
  const [energy, setEnergy] = React.useState(DEFAULT_ENERGY);

  const handleAdd = () => {
    const res = localCreateTaskType({ name, color, energy: Number(energy) });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Dodano typ „${res.data.name}”`);
    setName('');
    onCreated?.(res.data.id);
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-xs font-semibold text-foreground">Dodaj nowy typ zadania</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="new-type-name" className="text-xs">Nazwa</Label>
          <Input
            id="new-type-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Fizyka"
            maxLength={MAX_TASK_TYPE_NAME_LENGTH}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-type-energy" className="text-xs">Obciążenie</Label>
          <Select value={energy} onValueChange={setEnergy}>
            <SelectTrigger id="new-type-energy" className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {Object.entries(ENERGY_LEVEL_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <ColorSwatchPicker color={color} onChange={setColor} />
        <Button type="button" size="sm" onClick={handleAdd} className="h-8 gap-1">
          <PlusIcon className="size-3.5" aria-hidden="true" />
          <span>Dodaj typ</span>
        </Button>
      </div>
    </div>
  );
}

function DeleteTypeConfirmButton({
  type,
  canDelete,
  onDelete,
}: {
  readonly type: ManageableTaskType;
  readonly canDelete: boolean;
  readonly onDelete: (id: string) => void;
}) {
  const usageCount = countTaskTypeUsage(type.id);
  const description =
    usageCount > 0
      ? `Typ „${type.name}” jest używany (${usageCount} powiązanych zadań, bloków lub zajęć). Usunięcie typu usunie również te powiązane wpisy.`
      : `Czy na pewno chcesz usunąć typ „${type.name}”?`;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canDelete}
          aria-label={`Usuń typ ${type.name}`}
          className="size-7 text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon className="size-3.5" aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Usunąć typ zadania?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => onDelete(type.id)}>
            Tak, usuń
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function TaskTypesManager({ taskTypes, onCreated, onDeleted }: TaskTypesManagerProps) {
  const handleDelete = (id: string) => {
    const res = localDeleteTaskType(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Usunięto typ zadania');
    onDeleted?.(id);
  };

  return (
    <div className="space-y-3">
      <NewTypeFormCard onCreated={onCreated} />
      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {taskTypes.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-1.5 text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="size-3 shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: t.color }}
                aria-hidden="true"
              />
              <span className="truncate font-medium">{t.name}</span>
            </div>
            <DeleteTypeConfirmButton
              type={t}
              canDelete={taskTypes.length > 1}
              onDelete={handleDelete}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
