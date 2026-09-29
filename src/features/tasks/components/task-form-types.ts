import type { Priority } from '@/domain/types';
import type { TaskTypeRow } from '@/features/task-types';
import type { BacklogTaskItem, TaskWithDetails } from '../types';

export const MIN_ESTIMATE_MINUTES = 5;
export const MAX_ESTIMATE_MINUTES = 6000;
export const ESTIMATE_STEP_MINUTES = 5;

export const MIN_SESSION_MINUTES = 30;
export const MAX_SESSION_MINUTES = 180;
export const SESSION_GRID_STEP = 15;
export const DEFAULT_SESSION_MINUTES = 90;

export const MIN_HARD_DURATION_MINUTES = 15;
export const MAX_HARD_DURATION_MINUTES = 720;
export const HARD_DURATION_STEP_MINUTES = 15;
export const DEFAULT_HARD_DURATION_MINUTES = 60;

export const MAX_NOTES_LENGTH = 2000;
export const MIN_TYPE_NAME_LENGTH = 1;
export const MAX_TYPE_NAME_LENGTH = 60;

export const PRIORITY_HIGH: Priority = 1;
export const PRIORITY_MEDIUM: Priority = 2;
export const PRIORITY_LOW: Priority = 3;
export const DEFAULT_PRIORITY = PRIORITY_MEDIUM;

export const DEFAULT_PACE = 1.0;
export const MAX_NOTE_SNIPPET_LENGTH = 80;
export const MINUTES_PER_HOUR = 60;
export const NOTES_TEXTAREA_ROWS = 3;

export const SESSION_OPTIONS = [
  { value: '', label: 'Domyślna (90 min)' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '1 h' },
  { value: '75', label: '1 h 15 min' },
  { value: '90', label: '1 h 30 min' },
  { value: '105', label: '1 h 45 min' },
  { value: '120', label: '2 h' },
  { value: '135', label: '2 h 15 min' },
  { value: '150', label: '2 h 30 min' },
  { value: '165', label: '2 h 45 min' },
  { value: '180', label: '3 h' },
] as const;

export const PRIORITY_OPTIONS = [
  { value: '1', label: '1 — Wysoki' },
  { value: '2', label: '2 — Średni' },
  { value: '3', label: '3 — Niski' },
] as const;

export interface TaskFormData {
  readonly typeId: string;
  readonly isOneOff: boolean;
  readonly newOneOffTypeName: string;
  readonly priority: Priority;
  readonly fixation: 'flexible' | 'hard';
  readonly estimateMinutes: string;
  readonly sessionMinutes: string;
  readonly deadlineDate: string;
  readonly deadlineTime: string;
  readonly hardDate: string;
  readonly hardStartTime: string;
  readonly hardDurationMinutes: string;
  readonly notes: string;
}

export type TaskFormErrors = Record<string, string[] | undefined>;

export type TaskInitialData = TaskWithDetails | BacklogTaskItem;

function splitIsoDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) {
    return { date: '', time: '' };
  }
  const dateObj = new Date(iso);
  if (Number.isNaN(dateObj.getTime())) {
    return { date: '', time: '' };
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
  const time = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
  return { date, time };
}

export function createDefaultFormData(
  initialData?: TaskInitialData,
  defaultTypeId?: string,
): TaskFormData {
  if (!initialData) {
    return {
      typeId: defaultTypeId ?? '',
      isOneOff: false,
      newOneOffTypeName: '',
      priority: DEFAULT_PRIORITY,
      fixation: 'flexible',
      estimateMinutes: '',
      sessionMinutes: '',
      deadlineDate: '',
      deadlineTime: '',
      hardDate: '',
      hardStartTime: '',
      hardDurationMinutes: String(DEFAULT_HARD_DURATION_MINUTES),
      notes: '',
    };
  }

  const deadlineParts = splitIsoDateTime(initialData.deadline);

  return {
    typeId: initialData.typeId,
    isOneOff: false,
    newOneOffTypeName: '',
    priority: initialData.priority,
    fixation: initialData.fixation,
    estimateMinutes:
      initialData.estimateMinutes !== null ? String(initialData.estimateMinutes) : '',
    sessionMinutes:
      initialData.sessionMinutes !== null ? String(initialData.sessionMinutes) : '',
    deadlineDate: deadlineParts.date,
    deadlineTime: deadlineParts.time,
    hardDate: '',
    hardStartTime: '',
    hardDurationMinutes: String(DEFAULT_HARD_DURATION_MINUTES),
    notes: initialData.notes ?? '',
  };
}

export type TaskTypeOption = TaskTypeRow;
