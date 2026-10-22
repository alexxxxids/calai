'use client';

import * as React from 'react';
import { SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimetableImportDialog } from '@/features/ai/components/timetable-import-dialog';

export interface TimetableTypeOptionLike {
  readonly id: string;
  readonly name?: string;
}

export interface TimetableImportTriggerProps {
  readonly taskTypes?: readonly TimetableTypeOptionLike[];
  readonly onSuccess?: () => void;
  readonly disabled?: boolean;
}

export const TIMETABLE_TRIGGER_LABEL = 'Wgraj plan lekcji (AI)';

export function TimetableImportTrigger({
  taskTypes,
  onSuccess,
  disabled = false,
}: TimetableImportTriggerProps) {
  const [open, setOpen] = React.useState(false);

  const defaultTypeId = taskTypes?.[0]?.id ?? '';
  const isTriggerDisabled = disabled || !defaultTypeId;

  const handleImported = React.useCallback(() => {
    setOpen(false);
    onSuccess?.();
  }, [onSuccess]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2 text-sm font-medium"
        disabled={isTriggerDisabled}
        onClick={() => setOpen(true)}
        aria-label={TIMETABLE_TRIGGER_LABEL}
      >
        <SparklesIcon className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
        <span>{TIMETABLE_TRIGGER_LABEL}</span>
      </Button>

      {open && defaultTypeId && (
        <TimetableImportDialog
          open={open}
          onOpenChange={setOpen}
          defaultTypeId={defaultTypeId}
          onImported={handleImported}
        />
      )}
    </>
  );
}
