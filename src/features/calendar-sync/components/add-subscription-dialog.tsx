'use client';

import { Loader2Icon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface TaskTypeOption {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface AddSubscriptionDialogProps {
  readonly taskTypes: ReadonlyArray<TaskTypeOption>;
  readonly onAdd: (data: { name: string; url: string; typeId: string }) => Promise<boolean>;
  readonly isPending?: boolean;
}

function SubscriptionFormFields({
  name,
  onNameChange,
  url,
  onUrlChange,
  typeId,
  onTypeIdChange,
  taskTypes,
  isPending,
}: {
  readonly name: string;
  readonly onNameChange: (val: string) => void;
  readonly url: string;
  readonly onUrlChange: (val: string) => void;
  readonly typeId: string;
  readonly onTypeIdChange: (val: string) => void;
  readonly taskTypes: ReadonlyArray<TaskTypeOption>;
  readonly isPending?: boolean;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <label htmlFor="sub-name" className="text-sm font-medium">
          Nazwa
        </label>
        <Input
          id="sub-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={60}
          placeholder="np. Plan zajęć uczelni"
          disabled={isPending}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="sub-url" className="text-sm font-medium">
          Adres URL
        </label>
        <Input
          id="sub-url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://... lub webcal://..."
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Wklej publiczny adres URL kalendarza (obsługiwane: https:// oraz webcal://).
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="sub-type" className="text-sm font-medium">
          Typ zadania
        </label>
        <Select value={typeId} onValueChange={onTypeIdChange} disabled={isPending}>
          <SelectTrigger id="sub-type">
            <SelectValue placeholder="Wybierz typ zadania" />
          </SelectTrigger>
          <SelectContent>
            {taskTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: type.color }}
                  />
                  <span>{type.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function AddSubscriptionDialog({
  taskTypes,
  onAdd,
  isPending = false,
}: AddSubscriptionDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [typeId, setTypeId] = useState(taskTypes[0]?.id ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim() || !typeId) {
      return;
    }
    const success = await onAdd({
      name: name.trim(),
      url: url.trim(),
      typeId,
    });
    if (success) {
      setName('');
      setUrl('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="size-4 mr-1.5" aria-hidden="true" />
          Dodaj kalendarz
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Dodaj subskrypcję kalendarza</DialogTitle>
            <DialogDescription>
              Wprowadź publiczny link iCal, aby automatycznie importować wydarzenia.
            </DialogDescription>
          </DialogHeader>
          <SubscriptionFormFields
            name={name}
            onNameChange={setName}
            url={url}
            onUrlChange={setUrl}
            typeId={typeId}
            onTypeIdChange={setTypeId}
            taskTypes={taskTypes}
            isPending={isPending}
          />
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isPending || !name.trim() || !url.trim()}>
              {isPending && <Loader2Icon className="size-4 animate-spin mr-1.5" aria-hidden="true" />}
              Zapisz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
