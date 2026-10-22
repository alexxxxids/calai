'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
import { createTask, updateTask } from '../actions';
import { calculatePacePreview } from '../pace-preview';
import { TaskAiDecomposeTrigger } from './task-ai-decompose-trigger';
import { TaskFormFields } from './task-form-fields';
import {
  createDefaultFormData,
  DEFAULT_PACE,
  MIN_ESTIMATE_MINUTES,
  type TaskFormData,
  type TaskFormErrors,
  type TaskInitialData,
  type TaskTypeOption,
} from './task-form-types';

interface TaskFormDialogProps {
  readonly initialData?: TaskInitialData;
  readonly taskTypes?: readonly TaskTypeOption[];
  readonly children?: React.ReactNode;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onSuccess?: () => void;
}

function resolvePace(
  formData: TaskFormData,
  initialData?: TaskInitialData,
  taskTypes?: readonly TaskTypeOption[],
): number {
  if (formData.isOneOff) {
    return DEFAULT_PACE;
  }
  if (initialData && 'typePace' in initialData && initialData.typeId === formData.typeId) {
    return initialData.typePace;
  }
  const matching = taskTypes?.find((t) => t.id === formData.typeId);
  if (matching && 'pace' in matching && typeof matching.pace === 'number') {
    return matching.pace;
  }
  return DEFAULT_PACE;
}

function buildUpdateTaskPayload(formData: TaskFormData, initialId: string, timeZone: string) {
  return {
    taskId: initialId,
    typeId: formData.typeId || undefined,
    priority: formData.priority,
    notes: formData.notes.trim() || undefined,
    estimateMinutes: formData.estimateMinutes ? Number(formData.estimateMinutes) : null,
    sessionMinutes: formData.sessionMinutes ? Number(formData.sessionMinutes) : null,
    deadlineDate: formData.deadlineDate || null,
    deadlineTime: formData.deadlineTime || null,
    timeZone,
  };
}

function buildCreateTaskPayload(formData: TaskFormData, timeZone: string) {
  const base = {
    priority: formData.priority,
    fixation: formData.fixation,
    notes: formData.notes.trim() || undefined,
    timeZone,
  };
  const typePart = formData.isOneOff
    ? { newOneOffTypeName: formData.newOneOffTypeName.trim() }
    : { typeId: formData.typeId || undefined };

  if (formData.fixation === 'hard') {
    return {
      ...base,
      ...typePart,
      date: formData.hardDate,
      startTime: formData.hardStartTime,
      durationMinutes: Number(formData.hardDurationMinutes),
    };
  }

  return {
    ...base,
    ...typePart,
    estimateMinutes: formData.estimateMinutes ? Number(formData.estimateMinutes) : undefined,
    sessionMinutes: formData.sessionMinutes ? Number(formData.sessionMinutes) : undefined,
    deadlineDate: formData.deadlineDate || undefined,
    deadlineTime: formData.deadlineTime || undefined,
  };
}

function buildPayload(formData: TaskFormData, initialId?: string) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw';
  if (initialId) {
    return {
      isUpdate: true as const,
      data: buildUpdateTaskPayload(formData, initialId, timeZone),
    };
  }

  return {
    isUpdate: false as const,
    data: buildCreateTaskPayload(formData, timeZone),
  };
}

interface TaskFormContentProps {
  readonly initialData?: TaskInitialData;
  readonly taskTypes?: readonly TaskTypeOption[];
  readonly onDone: () => void;
}

function TaskFormContent({ initialData, taskTypes, onDone }: TaskFormContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [formData, setFormData] = React.useState(() =>
    createDefaultFormData(initialData, taskTypes?.[0]?.id),
  );
  const [errors, setErrors] = React.useState<TaskFormErrors>({});

  const handleFieldChange = <K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const pace = resolvePace(formData, initialData, taskTypes);
  const estNumber = Number(formData.estimateMinutes);
  const pacePreview =
    formData.fixation === 'flexible' && Number.isFinite(estNumber) && estNumber >= MIN_ESTIMATE_MINUTES
      ? calculatePacePreview(estNumber, pace).formattedText
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const payload = buildPayload(formData, initialData?.id);
      const result = payload.isUpdate
        ? await updateTask(payload.data)
        : await createTask(payload.data);

      if (!result.ok) {
        if (result.fieldErrors) {
          setErrors(result.fieldErrors);
        } else {
          toast.error(result.error);
        }
        return;
      }

      toast.success(initialData ? 'Zaktualizowano zadanie' : 'Utworzono zadanie');
      router.refresh();
      onDone();
    });
  };

  const title = initialData ? 'Edytuj zadanie' : 'Nowe zadanie';
  const submitText = isPending ? 'Zapisywanie...' : initialData ? 'Zapisz zmiany' : 'Dodaj zadanie';

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Wprowadź szczegóły zadania, szacowany czas lub termin w kalendarzu.
        </DialogDescription>
      </DialogHeader>

      <TaskFormFields
        formData={formData}
        taskTypes={taskTypes}
        isEditing={Boolean(initialData)}
        errors={errors}
        pacePreview={pacePreview}
        onChange={handleFieldChange}
      />

      <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row sm:justify-between">
        {!initialData && (
          <TaskAiDecomposeTrigger
            typeId={formData.isOneOff ? null : (formData.typeId || null)}
            taskTypes={taskTypes}
            initialDescription={formData.notes}
            initialDeadline={formData.deadlineDate}
            onSuccess={onDone}
            disabled={isPending}
          />
        )}
        <div className="flex gap-2 justify-end sm:ml-auto">
          <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
            Anuluj
          </Button>
          <Button type="submit" disabled={isPending}>
            {submitText}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

export function TaskFormDialog({
  initialData,
  taskTypes,
  children,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onSuccess,
}: TaskFormDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isOpen = controlledOpen ?? uncontrolledOpen;
  const setIsOpen = setControlledOpen ?? setUncontrolledOpen;

  const handleDone = () => {
    setIsOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {isOpen && (
          <TaskFormContent
            key={initialData?.id ?? 'new-task'}
            initialData={initialData}
            taskTypes={taskTypes}
            onDone={handleDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
