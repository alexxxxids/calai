import {
  MAX_HORIZON_DAYS,
  MS_PER_DAY,
  PRIORITY,
  START_BUFFER,
  TYPE_PACE_SEED,
} from '@/domain/constants';
import {
  effectiveEnergyLimit,
  isStressMode,
  stressMultiplier,
  type DailyMetrics,
  type WeeklyScores,
} from '@/domain/energy';
import { paceSample } from '@/domain/pace';
import { normalizeSessionMinutes, workToPlan } from '@/domain/scheduler';
import {
  addDaysToLocalDate,
  instantToLocalDate,
  minutesToMs,
  zonedToInstant,
} from '@/domain/time';
import type {
  LocalDate,
  LocalTime,
  PlannerTask,
  Priority,
} from '@/domain/types';
import { postgresToTime } from '@/features/profile/schemas';
import type { ReflectionLevel } from '@/types/db';

import { buildBusyAndRemovals, type BusyTimeContext } from './build-busy';
import { calculateTaskPaces } from './build-paces';
import type {
  BuildInputResult,
  PlannerBlockRow,
  PlannerData,
  PlannerReflectionRow,
  PlannerTaskRow,
  PlannerTaskType,
} from './types';

const SEVEN_DAYS_COUNT = 7;
const SEVEN_DAYS_MS = SEVEN_DAYS_COUNT * MS_PER_DAY;
const REFLECTION_MAX_AGE_DAYS = 14;
const HORIZON_BUFFER_DAYS = 1;
const DEFAULT_TASK_ENERGY = 1;
const START_OF_DAY_TIME: LocalTime = '00:00';

function parseIso(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Nieprawidłowy znacznik czasu ISO: "${iso}"`);
  }
  return ms;
}

function extractWeeklyScores(
  reflection: PlannerReflectionRow | null,
  level: ReflectionLevel,
  todayDate: LocalDate
): WeeklyScores | null {
  if (reflection === null || level === 'basic') {
    return null;
  }
  const cutoffDate = addDaysToLocalDate(reflection.week_start, REFLECTION_MAX_AGE_DAYS);
  if (cutoffDate < todayDate) {
    return null;
  }
  return {
    fatigue: reflection.fatigue,
    stress: reflection.stress,
    focus: reflection.focus,
    distractions: reflection.distractions,
  };
}

function calculateDailyMetrics(
  blocks: readonly PlannerBlockRow[],
  nowMs: number
): DailyMetrics {
  const closedSince = nowMs - SEVEN_DAYS_MS;
  let done = 0;
  let missed = 0;
  const samples: number[] = [];

  for (const block of blocks) {
    if (block.closed_at === null) {
      continue;
    }
    const closedAtMs = parseIso(block.closed_at);
    if (closedAtMs < closedSince) {
      continue;
    }
    if (block.status === 'done') {
      done += 1;
      if (block.work_minutes > 0 && block.actual_minutes !== null && block.actual_minutes > 0) {
        samples.push(paceSample(block.actual_minutes, block.work_minutes));
      }
    } else if (block.status === 'missed') {
      missed += 1;
    }
  }

  const meanPaceSample =
    samples.length > 0 ? samples.reduce((sum, s) => sum + s, 0) / samples.length : null;

  return { done, missed, meanPaceSample };
}

function toPriority(priority: number): Priority {
  if (
    priority === PRIORITY.high ||
    priority === PRIORITY.normal ||
    priority === PRIORITY.low
  ) {
    return priority;
  }
  return PRIORITY.normal;
}

function calculateTaskWork(
  taskId: string,
  blocks: readonly PlannerBlockRow[],
  time: BusyTimeContext
): { readonly doneWorkMinutes: number; readonly keptWorkMinutes: number } {
  let doneWorkMinutes = 0;
  let keptWorkMinutes = 0;
  const bufferCutoffMs = time.nowMs + time.startBufferMs;

  for (const block of blocks) {
    if (block.task_id !== taskId) {
      continue;
    }
    if (block.status === 'done') {
      doneWorkMinutes += block.work_minutes;
    } else if (block.status === 'planned') {
      const endsAtMs = parseIso(block.ends_at);
      const startsAtMs = parseIso(block.starts_at);
      if (endsAtMs > time.nowMs && (block.pinned || startsAtMs < bufferCutoffMs)) {
        keptWorkMinutes += block.work_minutes;
      }
    }
  }

  return { doneWorkMinutes, keptWorkMinutes };
}

function toPlannerTask(
  task: PlannerTaskRow,
  neededWork: number,
  taskType: PlannerTaskType | undefined,
  pace: number
): PlannerTask {
  return {
    id: task.id,
    priority: toPriority(task.priority),
    deadline: task.deadline ? parseIso(task.deadline) : null,
    createdAt: parseIso(task.created_at),
    energy: taskType ? taskType.energy : DEFAULT_TASK_ENERGY,
    workToPlan: neededWork,
    pace,
    sessionMinutes:
      task.session_minutes === null
        ? null
        : normalizeSessionMinutes(task.session_minutes),
  };
}

function buildPlannerTasks(
  tasks: readonly PlannerTaskRow[],
  typeMap: Map<string, PlannerTaskType>,
  blocks: readonly PlannerBlockRow[],
  options: {
    readonly taskPaces: Map<string, number>;
    readonly time: BusyTimeContext;
  }
): PlannerTask[] {
  const result: PlannerTask[] = [];

  for (const task of tasks) {
    if (
      task.status !== 'active' ||
      task.fixation !== 'flexible' ||
      task.estimate_minutes === null
    ) {
      continue;
    }

    const { doneWorkMinutes, keptWorkMinutes } = calculateTaskWork(
      task.id,
      blocks,
      options.time
    );

    const neededWork = workToPlan({
      estimateMinutes: task.estimate_minutes,
      doneWorkMinutes,
      keptWorkMinutes,
    });

    if (neededWork > 0) {
      const pace = options.taskPaces.get(task.id) ?? TYPE_PACE_SEED;
      result.push(toPlannerTask(task, neededWork, typeMap.get(task.type_id), pace));
    }
  }

  return result;
}

function determineEnergySettings(
  data: PlannerData,
  nowMs: number,
  todayDate: LocalDate
): { readonly energyLimit: number; readonly stressMode: boolean } {
  const daily = calculateDailyMetrics(data.blocks, nowMs);
  const weekly = extractWeeklyScores(
    data.latestReflection,
    data.profile.reflection_level,
    todayDate
  );
  const multiplier = stressMultiplier({ weekly, daily });
  const energyLimit = effectiveEnergyLimit(data.profile.daily_energy_limit, multiplier);
  const stressMode = isStressMode(multiplier);
  return { energyLimit, stressMode };
}

export function buildPlannerInput(
  data: PlannerData,
  now: Date | number
): BuildInputResult {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const timezone = data.profile.timezone;
  const todayDate = instantToLocalDate(nowMs, timezone);
  const time: BusyTimeContext = {
    startOfToday: zonedToInstant(todayDate, START_OF_DAY_TIME, timezone),
    nowMs,
    startBufferMs: minutesToMs(START_BUFFER),
  };
  const horizonEnd = zonedToInstant(
    addDaysToLocalDate(todayDate, MAX_HORIZON_DAYS + HORIZON_BUFFER_DAYS),
    START_OF_DAY_TIME,
    timezone
  );

  const { energyLimit, stressMode } = determineEnergySettings(data, nowMs, todayDate);
  const typeMap = new Map(data.taskTypes.map((type) => [type.id, type]));
  const taskPaces = calculateTaskPaces(data.taskTypes, data.tasks, data.blocks);
  const tasks = buildPlannerTasks(data.tasks, typeMap, data.blocks, {
    taskPaces,
    time,
  });

  const { busy, removeBlockIds } = buildBusyAndRemovals(
    data,
    time,
    horizonEnd,
    timezone
  );

  return {
    input: {
      now: nowMs,
      timezone,
      dayStart: postgresToTime(data.profile.day_start),
      dayEnd: postgresToTime(data.profile.day_end),
      energyLimit,
      stressMode,
      busy,
      tasks,
    },
    removeBlockIds,
  };
}
