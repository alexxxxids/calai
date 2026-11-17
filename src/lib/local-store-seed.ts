import { addDaysToLocalDate, instantToLocalDate, zonedToInstant } from '@/domain/time';
import type { RecurringEventWithRelations } from '@/features/recurring-events/types';
import type { BacklogTaskItem } from '@/features/tasks/types';
import type { TaskType } from '@/types/db';
import type { LocalBlock, LocalHabit, LocalStoreState } from './local-store-types';

export const DEFAULT_TIMEZONE = 'Europe/Warsaw';
const MONDAY_WD = 1;
const TUESDAY_WD = 2;
const WEDNESDAY_WD = 3;
const THURSDAY_WD = 4;
const FRIDAY_WD = 5;
const SATURDAY_WD = 6;
const SUNDAY_WD = 7;
const WORK_WEEKDAYS = [MONDAY_WD, TUESDAY_WD, WEDNESDAY_WD, THURSDAY_WD, FRIDAY_WD];
const ALL_WEEKDAYS = [...WORK_WEEKDAYS, SATURDAY_WD, SUNDAY_WD];
const WORK_NINETY = 90;
const WORK_SIXTY = 60;
const WORK_FORTY_FIVE = 45;
const ESTIMATE_CODE = 120;
const ENERGY_THREE = 3;
const PRIORITY_HIGH = 1;
const PRIORITY_MEDIUM = 2;
const PRIORITY_LOW = 3;
const DAYS_PAST = -1;
const DAYS_TWO = 2;
const DAYS_THREE = 3;
const DAYS_FIVE = 5;

function isoAt(date: string, time: string, timeZone: string): string {
  return new Date(zonedToInstant(date, time, timeZone)).toISOString();
}

function createDemoTypes(): readonly TaskType[] {
  return [
    { id: 'type-math', name: 'Matematyka', color: '#3b82f6', energy: ENERGY_THREE, is_one_off: false, is_rest: false, archived_at: null },
    { id: 'type-code', name: 'Programowanie', color: '#8b5cf6', energy: ENERGY_THREE, is_one_off: false, is_rest: false, archived_at: null },
    { id: 'type-eng', name: 'Angielski', color: '#10b981', energy: 2, is_one_off: false, is_rest: false, archived_at: null },
    { id: 'type-sport', name: 'Trening', color: '#f97316', energy: 1, is_one_off: false, is_rest: false, archived_at: null },
    { id: 'type-school', name: 'Szkoła', color: '#64748b', energy: 2, is_one_off: false, is_rest: false, archived_at: null },
  ];
}

function createDemoRecurring(today: string): readonly RecurringEventWithRelations[] {
  const schoolRel = { id: 'type-school', name: 'Szkoła', color: '#64748b', energy: 2 };
  const sportRel = { id: 'type-sport', name: 'Trening', color: '#f97316', energy: 1 };
  const start = addDaysToLocalDate(today, -DAYS_FIVE);
  return [
    { id: 'rec-1', title: 'Lekcje: Matematyka i Fizyka', type_id: 'type-school', weekday: MONDAY_WD, start_time: '08:00:00', end_time: '11:30:00', valid_from: start, valid_until: null, task_types: schoolRel },
    { id: 'rec-2', title: 'Lekcje: Polski i Historia', type_id: 'type-school', weekday: WEDNESDAY_WD, start_time: '08:00:00', end_time: '11:30:00', valid_from: start, valid_until: null, task_types: schoolRel },
    { id: 'rec-3', title: 'Siłownia / Bieganie', type_id: 'type-sport', weekday: THURSDAY_WD, start_time: '18:00:00', end_time: '19:30:00', valid_from: start, valid_until: null, task_types: sportRel },
  ];
}

function createDemoTasks(today: string, timeZone: string): readonly BacklogTaskItem[] {
  const nowIso = new Date().toISOString();
  return [
    {
      id: 'task-1', typeId: 'type-math', typeName: 'Matematyka', typeColor: '#3b82f6', typeEnergy: ENERGY_THREE,
      isOneOff: false, priority: PRIORITY_HIGH, fixation: 'flexible',
      notes: 'Powtórka funkcji kwadratowej przed sprawdzianem', estimateMinutes: WORK_NINETY,
      sessionMinutes: WORK_NINETY, deadline: isoAt(addDaysToLocalDate(today, DAYS_THREE), '20:00', timeZone),
      createdAt: nowIso, typePace: 1,
    },
    {
      id: 'task-2', typeId: 'type-code', typeName: 'Programowanie', typeColor: '#8b5cf6', typeEnergy: ENERGY_THREE,
      isOneOff: false, priority: PRIORITY_HIGH, fixation: 'flexible',
      notes: 'Komponent koszyka zadań w React + TypeScript', estimateMinutes: ESTIMATE_CODE,
      sessionMinutes: WORK_SIXTY, deadline: isoAt(addDaysToLocalDate(today, DAYS_FIVE), '22:00', timeZone),
      createdAt: nowIso, typePace: 1,
    },
    {
      id: 'task-3', typeId: 'type-eng', typeName: 'Angielski', typeColor: '#10b981', typeEnergy: 2,
      isOneOff: false, priority: PRIORITY_MEDIUM, fixation: 'flexible',
      notes: 'Słówka z rozdziału 4 i krótki esej', estimateMinutes: WORK_FORTY_FIVE,
      sessionMinutes: WORK_FORTY_FIVE, deadline: isoAt(addDaysToLocalDate(today, DAYS_TWO), '18:00', timeZone),
      createdAt: nowIso, typePace: 1,
    },
    {
      id: 'task-4', typeId: 'type-sport', typeName: 'Trening', typeColor: '#f97316', typeEnergy: 1,
      isOneOff: false, priority: PRIORITY_LOW, fixation: 'flexible',
      notes: 'Rozciąganie i mobilność po pracy przy biurku', estimateMinutes: WORK_FORTY_FIVE,
      sessionMinutes: WORK_FORTY_FIVE, deadline: null, createdAt: nowIso, typePace: 1,
    },
  ];
}

function createDemoBlocks(today: string, timeZone: string): readonly LocalBlock[] {
  const yesterday = addDaysToLocalDate(today, DAYS_PAST);
  const tomorrow = addDaysToLocalDate(today, 1);
  return [
    {
      id: 'block-past-1', taskId: 'task-1', typeId: 'type-math', title: 'Matematyka',
      notes: 'Zadania z poprzedniego działu', startsAt: isoAt(yesterday, '16:00', timeZone),
      endsAt: isoAt(yesterday, '17:30', timeZone), workMinutes: WORK_NINETY,
      status: 'planned', source: 'planner', pinned: false, actualMinutes: null,
    },
    {
      id: 'block-today-1', taskId: 'task-2', typeId: 'type-code', title: 'Programowanie',
      notes: 'Konfiguracja kalendarza', startsAt: isoAt(today, '14:00', timeZone),
      endsAt: isoAt(today, '15:30', timeZone), workMinutes: WORK_NINETY,
      status: 'planned', source: 'manual', pinned: false, actualMinutes: null,
    },
    {
      id: 'block-tomorrow-1', taskId: 'task-3', typeId: 'type-eng', title: 'Angielski',
      notes: 'Listening i powtórka gramatyki', startsAt: isoAt(tomorrow, '15:00', timeZone),
      endsAt: isoAt(tomorrow, '16:00', timeZone), workMinutes: WORK_SIXTY,
      status: 'planned', source: 'planner', pinned: false, actualMinutes: null,
    },
  ];
}

function createDemoHabits(today: string): readonly LocalHabit[] {
  const yesterday = addDaysToLocalDate(today, DAYS_PAST);
  return [
    { id: 'hab-1', name: 'Czytanie 20 min', weekdays: WORK_WEEKDAYS, completedDays: [yesterday] },
    { id: 'hab-2', name: 'Woda 2L dziennie', weekdays: ALL_WEEKDAYS, completedDays: [yesterday, today] },
    { id: 'hab-3', name: 'Rozciąganie pleców', weekdays: WORK_WEEKDAYS, completedDays: [] },
  ];
}

export function createSeedState(timeZone = DEFAULT_TIMEZONE): LocalStoreState {
  const today = instantToLocalDate(Date.now(), timeZone);
  return {
    taskTypes: createDemoTypes(),
    tasks: createDemoTasks(today, timeZone),
    blocks: createDemoBlocks(today, timeZone),
    recurringEvents: createDemoRecurring(today),
    habits: createDemoHabits(today),
  };
}
