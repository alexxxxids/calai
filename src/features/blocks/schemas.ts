import * as z from 'zod';

export const MIN_BLOCK_DURATION = 15;
export const MAX_BLOCK_DURATION = 720;
export const MIN_ACTUAL_MINUTES = 1;
export const MAX_ACTUAL_MINUTES = 1440;
export const MIN_WORK_MINUTES = 1;
export const MAX_WORK_MINUTES = 1440;
export const SLOT_MINUTES = 15;
export const MS_IN_MINUTE = 60_000;
export const MIN_DURATION_MS = MIN_BLOCK_DURATION * MS_IN_MINUTE;
export const MAX_DURATION_MS = MAX_BLOCK_DURATION * MS_IN_MINUTE;

export const ScheduleBlockSchema = z.object({
  taskId: z.string().uuid('Nieprawidłowy identyfikator zadania'),
  start: z.string().datetime('Nieprawidłowy format daty i godziny'),
  durationMinutes: z
    .number()
    .int('Czas trwania musi być liczbą całkowitą')
    .min(MIN_BLOCK_DURATION, `Minimalny czas trwania to ${MIN_BLOCK_DURATION} minut`)
    .max(MAX_BLOCK_DURATION, `Maksymalny czas trwania to ${MAX_BLOCK_DURATION} minut`),
});

export const MoveBlockSchema = z
  .object({
    blockId: z.string().uuid('Nieprawidłowy identyfikator bloku'),
    start: z.string().datetime('Nieprawidłowy format daty początkowej'),
    end: z.string().datetime('Nieprawidłowy format daty końcowej'),
  })
  .refine(
    (data) => new Date(data.end).getTime() > new Date(data.start).getTime(),
    {
      message: 'Koniec bloku musi być późniejszy niż początek',
      path: ['end'],
    },
  )
  .refine(
    (data) => {
      const durationMs = new Date(data.end).getTime() - new Date(data.start).getTime();
      return durationMs >= MIN_DURATION_MS;
    },
    {
      message: `Minimalny czas trwania bloku to ${MIN_BLOCK_DURATION} minut`,
      path: ['end'],
    },
  )
  .refine(
    (data) => {
      const durationMs = new Date(data.end).getTime() - new Date(data.start).getTime();
      return durationMs <= MAX_DURATION_MS;
    },
    {
      message: 'Czas trwania bloku nie może przekraczać 12 godzin (720 minut)',
      path: ['end'],
    },
  );

export const CloseBlockSchema = z
  .object({
    blockId: z.string().uuid('Nieprawidłowy identyfikator bloku'),
    status: z.enum(['done', 'missed']),
    actualMinutes: z
      .number()
      .int('Rzeczywisty czas trwania musi być liczbą całkowitą')
      .min(MIN_ACTUAL_MINUTES, 'Rzeczywisty czas trwania musi wynosić co najmniej 1 minutę')
      .max(MAX_ACTUAL_MINUTES, 'Rzeczywisty czas trwania nie może przekraczać 1440 minut')
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.status === 'done') {
        return typeof data.actualMinutes === 'number' && data.actualMinutes >= MIN_ACTUAL_MINUTES;
      }
      return true;
    },
    {
      message: 'Rzeczywisty czas trwania jest wymagany przy oznaczaniu bloku jako ukończony',
      path: ['actualMinutes'],
    },
  );

export const DeleteBlockSchema = z.object({
  blockId: z.string().uuid('Nieprawidłowy identyfikator bloku'),
});
