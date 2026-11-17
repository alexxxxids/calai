import type { TaskType } from '@/types/db';

export type TaskTypeRow = TaskType;

export {
  CreateTaskTypeSchema,
  UpdateTaskTypeSchema,
  ArchiveTaskTypeSchema,
  type CreateTaskTypeInput,
  type UpdateTaskTypeInput,
  type ArchiveTaskTypeInput,
  ColorSchema,
  EnergySchema,
  normalizeColor,
  MIN_TASK_TYPE_NAME_LENGTH,
  MAX_TASK_TYPE_NAME_LENGTH,
  MIN_ENERGY,
  MAX_ENERGY,
  ENERGY_LEVEL_LABELS,
} from './schemas';
