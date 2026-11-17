'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { CheckIcon, Trash2Icon, XIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatMinutes } from '@/lib/format';
import { ENERGY_LEVEL_LABELS } from '@/features/task-types/schemas';
import { localCloseBlock, localDeleteBlock } from '@/lib/local-store';
import type { CalendarEventItem } from '../types';
import {
  calculateBlockDurationMinutes,
  DEFAULT_WARSAW_TIMEZONE,
  formatEventTimeRange,
  getEventStatusBadge,
  isBlockActionable,
  MAX_ACTUAL_MINUTES,
  MIN_ACTUAL_MINUTES,
  validateActualMinutes,
} from './calendar-helpers';

export interface BlockDialogProps {
  readonly block: CalendarEventItem | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly timeZone?: string;
  readonly onBlockUpdated?: () => void;
}

function BlockDialogHeader({ title, color }: { readonly title: string; readonly color: string }) {
  return (
    <DialogHeader>
      <div className="flex items-center gap-2">
        <span
          className="size-3.5 shrink-0 rounded-full border border-black/10 dark:border-white/10"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <DialogTitle className="truncate">{title}</DialogTitle>
      </div>
      <DialogDescription className="sr-only">Szczegóły bloku w kalendarzu</DialogDescription>
    </DialogHeader>
  );
}

function BlockDialogBadges({
  block,
  timeZone,
  durationMinutes,
}: {
  readonly block: CalendarEventItem;
  readonly timeZone: string;
  readonly durationMinutes: number;
}) {
  const statusBadge = getEventStatusBadge(block.extendedProps.status);
  const energyLabel =
    ENERGY_LEVEL_LABELS[block.extendedProps.energy] ?? `${block.extendedProps.energy} pkt energii`;
  const timeRange = formatEventTimeRange(new Date(block.start), new Date(block.end), timeZone);
  const dateFormatted = formatDate(new Date(block.start), timeZone);

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="text-sm text-muted-foreground">
        <span>{dateFormatted}</span>
        {timeRange ? <span>, {timeRange}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={statusBadge.variant}>{statusBadge.text}</Badge>
        {block.extendedProps.pinned && <Badge variant="secondary">Przypięty</Badge>}
        <Badge variant="outline">{energyLabel}</Badge>
        {durationMinutes > 0 && <Badge variant="outline">{formatMinutes(durationMinutes)}</Badge>}
      </div>
    </div>
  );
}

function BlockSecondaryActions({
  isPending,
  onMiss,
  onDelete,
}: {
  readonly isPending: boolean;
  readonly onMiss: () => void;
  readonly onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <Button type="button" variant="outline" size="sm" onClick={onMiss} disabled={isPending}>
        <XIcon className="size-4 mr-1.5" />
        Nie wykonano
      </Button>
      <Button type="button" variant="destructive" size="sm" onClick={onDelete} disabled={isPending}>
        <Trash2Icon className="size-4 mr-1.5" />
        Usuń blok
      </Button>
    </div>
  );
}

function BlockDurationField({
  value,
  onChange,
  error,
  disabled,
  onSubmit,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error: string | null;
  readonly disabled: boolean;
  readonly onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="actual-minutes">Rzeczywisty czas trwania (minuty)</Label>
      <div className="flex items-center gap-2">
        <Input
          id="actual-minutes"
          type="number"
          min={MIN_ACTUAL_MINUTES}
          max={MAX_ACTUAL_MINUTES}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-32"
        />
        <Button type="button" onClick={onSubmit} disabled={disabled} className="flex-1">
          <CheckIcon className="size-4 mr-1.5" />
          {disabled ? 'Zapisywanie...' : 'Wykonano'}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export interface BlockActionResult {
  readonly ok: boolean;
  readonly error?: string;
}

export async function executeBlockAction(
  action: () => Promise<BlockActionResult>,
  onSuccess: () => void,
  successMsg: string,
): Promise<void> {
  try {
    const res = await action();
    if (res.ok) {
      toast.success(successMsg);
      onSuccess();
    } else {
      toast.error(res.error ?? 'Wystąpił nieoczekiwany błąd');
    }
  } catch {
    toast.error('Błąd połączenia');
  }
}

function BlockActionForm({
  block,
  onOpenChange,
  onBlockUpdated,
  defaultMinutes,
}: {
  readonly block: CalendarEventItem;
  readonly onOpenChange: (open: boolean) => void;
  readonly onBlockUpdated?: () => void;
  readonly defaultMinutes: number;
}) {
  const [actualMinutes, setActualMinutes] = React.useState(() =>
    String(defaultMinutes > 0 ? defaultMinutes : MIN_ACTUAL_MINUTES),
  );
  const [inputError, setInputError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const runAction = (
    action: () => Promise<{ ok: boolean; error?: string }>,
    successMsg: string,
  ) => {
    startTransition(async () => {
      await executeBlockAction(
        action,
        () => {
          onOpenChange(false);
          onBlockUpdated?.();
        },
        successMsg,
      );
    });
  };

  const handleComplete = () => {
    const validation = validateActualMinutes(actualMinutes);
    if (!validation.isValid || validation.minutes === undefined) {
      setInputError(validation.error ?? 'Nieprawidłowa wartość');
      return;
    }
    setInputError(null);
    runAction(
      async () =>
        localCloseBlock({
          blockId: block.id,
          status: 'done',
          actualMinutes: validation.minutes,
        }),
      'Blok został oznaczony jako wykonany',
    );
  };

  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <BlockDurationField
        value={actualMinutes}
        onChange={(val) => {
          setActualMinutes(val);
          if (inputError) setInputError(null);
        }}
        error={inputError}
        disabled={isPending}
        onSubmit={handleComplete}
      />
      <BlockSecondaryActions
        isPending={isPending}
        onMiss={() =>
          runAction(
            async () => localCloseBlock({ blockId: block.id, status: 'missed' }),
            'Blok został oznaczony jako pominięty',
          )
        }
        onDelete={() =>
          runAction(async () => localDeleteBlock({ blockId: block.id }), 'Blok został usunięty')
        }
      />
    </div>
  );
}

function BlockDialogContent({
  block,
  timeZone,
  onOpenChange,
  onBlockUpdated,
}: {
  readonly block: CalendarEventItem;
  readonly timeZone: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onBlockUpdated?: () => void;
}) {
  const durationMinutes = calculateBlockDurationMinutes(block.start, block.end);
  const actionable = isBlockActionable(block);

  return (
    <>
      <BlockDialogBadges block={block} timeZone={timeZone} durationMinutes={durationMinutes} />
      {actionable && (
        <BlockActionForm
          block={block}
          onOpenChange={onOpenChange}
          onBlockUpdated={onBlockUpdated}
          defaultMinutes={durationMinutes}
        />
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {actionable ? 'Anuluj' : 'Zamknij'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function BlockDialog({
  block,
  open,
  onOpenChange,
  timeZone = DEFAULT_WARSAW_TIMEZONE,
  onBlockUpdated,
}: BlockDialogProps) {
  if (!block) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <BlockDialogHeader title={block.title} color={block.color} />
        <BlockDialogContent
          key={`${block.id}-${open}`}
          block={block}
          timeZone={timeZone}
          onOpenChange={onOpenChange}
          onBlockUpdated={onBlockUpdated}
        />
      </DialogContent>
    </Dialog>
  );
}
