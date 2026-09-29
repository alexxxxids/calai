import { TYPE_PACE_SEED } from '@/domain/constants';
import { paceSample, taskPace, typePace } from '@/domain/pace';

import type {
  PlannerBlockRow,
  PlannerTaskRow,
  PlannerTaskType,
} from './types';

interface PaceSampleItem {
  readonly closedAtMs: number;
  readonly sample: number;
  readonly taskId: string;
  readonly typeId: string;
}

function parseIso(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Nieprawidłowy znacznik czasu ISO: "${iso}"`);
  }
  return ms;
}

function isPaceEligible(block: PlannerBlockRow): boolean {
  return (
    block.status === 'done' &&
    block.work_minutes > 0 &&
    block.actual_minutes !== null &&
    block.actual_minutes > 0 &&
    block.closed_at !== null &&
    block.task_id !== null
  );
}

function collectPaceSamples(
  tasks: readonly PlannerTaskRow[],
  blocks: readonly PlannerBlockRow[]
): {
  readonly typeSamples: Map<string, number[]>;
  readonly taskSamples: Map<string, number[]>;
} {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const items: PaceSampleItem[] = [];

  for (const block of blocks) {
    if (!isPaceEligible(block)) {
      continue;
    }
    const task = taskMap.get(block.task_id ?? '');
    if (!task) {
      continue;
    }
    items.push({
      closedAtMs: parseIso(block.closed_at ?? ''),
      sample: paceSample(block.actual_minutes ?? 0, block.work_minutes),
      taskId: task.id,
      typeId: task.type_id,
    });
  }

  items.sort((a, b) => a.closedAtMs - b.closedAtMs);

  const typeSamples = new Map<string, number[]>();
  const taskSamples = new Map<string, number[]>();

  for (const item of items) {
    const tSamples = typeSamples.get(item.typeId) ?? [];
    tSamples.push(item.sample);
    typeSamples.set(item.typeId, tSamples);

    const taskS = taskSamples.get(item.taskId) ?? [];
    taskS.push(item.sample);
    taskSamples.set(item.taskId, taskS);
  }

  return { typeSamples, taskSamples };
}

export function calculateTaskPaces(
  taskTypes: readonly PlannerTaskType[],
  tasks: readonly PlannerTaskRow[],
  blocks: readonly PlannerBlockRow[]
): Map<string, number> {
  const { typeSamples, taskSamples } = collectPaceSamples(tasks, blocks);

  const typePaces = new Map<string, number>();
  for (const type of taskTypes) {
    typePaces.set(type.id, typePace(typeSamples.get(type.id) ?? []));
  }

  const result = new Map<string, number>();
  for (const task of tasks) {
    const basePace = typePaces.get(task.type_id) ?? TYPE_PACE_SEED;
    result.set(task.id, taskPace(taskSamples.get(task.id) ?? [], basePace));
  }

  return result;
}
