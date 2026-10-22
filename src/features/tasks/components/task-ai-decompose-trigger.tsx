'use client';

import * as React from 'react';
import { SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiDecomposeDialog } from '@/features/ai/components/ai-decompose-dialog';

export interface TaskTypeOptionLike {
  readonly id: string;
  readonly name?: string;
  readonly is_one_off?: boolean;
}

export interface TaskAiDecomposeTriggerProps {
  readonly typeId: string | null;
  readonly taskTypes?: readonly TaskTypeOptionLike[];
  readonly initialDescription?: string;
  readonly initialDeadline?: string | null;
  readonly onSuccess?: (taskId: string) => void;
  readonly disabled?: boolean;
}

export const ONE_OFF_DISABLED_HINT = 'Wybierz stały typ zadania, aby rozbić przez AI';
export const NO_TYPE_DISABLED_HINT = 'Wybierz typ zadania przed analizą AI';
export const TRIGGER_BUTTON_LABEL = 'Rozbij przez AI';

export function TaskAiDecomposeTrigger({
  typeId,
  taskTypes,
  initialDescription,
  initialDeadline,
  onSuccess,
  disabled = false,
}: TaskAiDecomposeTriggerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedType = React.useMemo(() => {
    if (!typeId || !taskTypes) return null;
    return taskTypes.find((t) => t.id === typeId) ?? null;
  }, [typeId, taskTypes]);

  const isOneOff = selectedType?.is_one_off ?? false;
  const isDecomposeDisabled = disabled || !typeId || isOneOff;

  const hint = React.useMemo(() => {
    if (disabled) return undefined;
    if (!typeId) return NO_TYPE_DISABLED_HINT;
    if (isOneOff) return ONE_OFF_DISABLED_HINT;
    return undefined;
  }, [disabled, typeId, isOneOff]);

  const handleTaskCreated = React.useCallback(
    (taskId: string) => {
      setOpen(false);
      onSuccess?.(taskId);
    },
    [onSuccess],
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isDecomposeDisabled}
        title={hint}
        onClick={() => setOpen(true)}
        className="gap-1.5 text-xs font-medium"
      >
        <SparklesIcon className="size-3.5 text-amber-500" aria-hidden="true" />
        <span>{TRIGGER_BUTTON_LABEL}</span>
      </Button>

      {open && typeId && !isOneOff && (
        <AiDecomposeDialog
          open={open}
          onOpenChange={setOpen}
          typeId={typeId}
          description={initialDescription}
          deadline={initialDeadline}
          onTaskCreated={handleTaskCreated}
        />
      )}
    </>
  );
}
