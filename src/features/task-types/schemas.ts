import * as z from 'zod';

export const MIN_TASK_TYPE_NAME_LENGTH = 1;
export const MAX_TASK_TYPE_NAME_LENGTH = 60;
export const MIN_ENERGY = 0;
export const MAX_ENERGY = 3;

const SHORT_HEX_LENGTH = 4;
const FULL_HEX_LENGTH = 7;
const SHORT_HEX_REGEX = /^#[0-9a-f]{3}$/i;
const FULL_HEX_REGEX = /^#[0-9a-f]{6}$/i;

export const ENERGY_LEVEL_LABELS: Record<number, string> = {
  0: 'Regeneracja (0 pkt)',
  1: 'Lekkie (1 pkt)',
  2: 'Średnie (2 pkt)',
  3: 'Ciężkie (3 pkt)',
};

/**
 * Normalizes a color string into lowercase 6-digit hex '#rrggbb'.
 * Expands 3-digit shorthand '#rgb' into '#rrggbb'.
 */
export function normalizeColor(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Kolor musi być tekstem');
  }
  const trimmed = input.trim().toLowerCase();

  if (trimmed.length === SHORT_HEX_LENGTH && SHORT_HEX_REGEX.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  if (trimmed.length === FULL_HEX_LENGTH && FULL_HEX_REGEX.test(trimmed)) {
    return trimmed;
  }

  throw new Error(`Nieprawidłowy format koloru: ${input}`);
}

export const ColorSchema = z.string().transform((val, ctx) => {
  try {
    return normalizeColor(val);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Wymagany poprawny kod koloru HEX (np. #3b82f6)',
    });
    return z.NEVER;
  }
});

export const EnergySchema = z.coerce
  .number()
  .int('Poziom energii musi być liczbą całkowitą')
  .min(MIN_ENERGY, 'Minimalny poziom energii to 0')
  .max(MAX_ENERGY, 'Maksymalny poziom energii to 3');

export const CreateTaskTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(MIN_TASK_TYPE_NAME_LENGTH, 'Nazwa typu nie może być pusta')
    .max(MAX_TASK_TYPE_NAME_LENGTH, 'Nazwa typu może mieć maksymalnie 60 znaków'),
  color: ColorSchema,
  energy: EnergySchema,
});

export type CreateTaskTypeInput = z.infer<typeof CreateTaskTypeSchema>;

export const UpdateTaskTypeSchema = z.object({
  id: z.string().uuid('Nieprawidłowy identyfikator typu'),
  name: z
    .string()
    .trim()
    .min(MIN_TASK_TYPE_NAME_LENGTH, 'Nazwa typu nie może być pusta')
    .max(MAX_TASK_TYPE_NAME_LENGTH, 'Nazwa typu może mieć maksymalnie 60 znaków'),
  color: ColorSchema,
  energy: EnergySchema,
});

export type UpdateTaskTypeInput = z.infer<typeof UpdateTaskTypeSchema>;

export const ArchiveTaskTypeSchema = z.object({
  id: z.string().uuid('Nieprawidłowy identyfikator typu'),
});

export type ArchiveTaskTypeInput = z.infer<typeof ArchiveTaskTypeSchema>;
