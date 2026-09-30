import * as z from 'zod';

import { MS_PER_DAY } from '@/domain/constants';

export const MAX_CALENDAR_RANGE_DAYS = 62;
export const MAX_CALENDAR_RANGE_MS = MAX_CALENDAR_RANGE_DAYS * MS_PER_DAY;

export const calendarQuerySchema = z
  .object({
    start: z
      .string()
      .datetime({ offset: true, message: 'Nieprawidłowy format daty początkowej (oczekiwano ISO)' }),
    end: z
      .string()
      .datetime({ offset: true, message: 'Nieprawidłowy format daty końcowej (oczekiwano ISO)' }),
  })
  .refine((data) => Date.parse(data.end) > Date.parse(data.start), {
    message: 'Koniec zakresu musi być późniejszy niż początek',
    path: ['end'],
  })
  .refine((data) => Date.parse(data.end) - Date.parse(data.start) <= MAX_CALENDAR_RANGE_MS, {
    message: 'Zakres nie może przekraczać 62 dni',
    path: ['end'],
  });

export type CalendarQueryInput = z.infer<typeof calendarQuerySchema>;
