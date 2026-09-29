import { TYPE_PACE_SEED } from '@/domain/constants';
import { paceSample, typePace } from '@/domain/pace';
import type { Priority } from '@/domain/types';

import type { BacklogTaskItem } from './types';

export interface RawTaskTypeJoin {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly energy: number;
  readonly is_one_off: boolean;
}

export interface RawBacklogTask {
  readonly id: string;
  readonly type_id: string;
  readonly notes: string | null;
  readonly priority: number;
  readonly fixation: 'flexible' | 'hard';
  readonly estimate_minutes: number | null;
  readonly session_minutes: number | null;
  readonly deadline: string | null;
  readonly created_at: string;
  readonly task_types: RawTaskTypeJoin;
}

export interface PaceBlockData {
  readonly task_id: string | null;
  readonly work_minutes: number;
  readonly actual_minutes: number | null;
  readonly closed_at: string | null;
}

export interface PaceTaskData {
  readonly id: string;
  readonly type_id: string;
}

interface PaceSampleItem {
  readonly closedAtMs: number;
  readonly sample: number;
  readonly typeId: string;
}

function collectEligiblePaceItems(
  blocks: readonly PaceBlockData[],
  taskTypeMap: ReadonlyMap<string, string>,
): PaceSampleItem[] {
  const items: PaceSampleItem[] = [];
  for (const block of blocks) {
    if (!block.task_id || block.work_minutes <= 0 || !block.actual_minutes || block.actual_minutes <= 0 || !block.closed_at) {
      continue;
    }
    const typeId = taskTypeMap.get(block.task_id);
    if (!typeId) {
      continue;
    }
    const closedAtMs = Date.parse(block.closed_at);
    if (Number.isNaN(closedAtMs)) {
      continue;
    }
    items.push({
      closedAtMs,
      sample: paceSample(block.actual_minutes, block.work_minutes),
      typeId,
    });
  }
  return items;
}

export function calculateTypePaces(
  blocks: readonly PaceBlockData[],
  tasks: readonly PaceTaskData[],
): Map<string, number> {
  const taskTypeMap = new Map(tasks.map((t) => [t.id, t.type_id]));
  const items = collectEligiblePaceItems(blocks, taskTypeMap);
  items.sort((a, b) => a.closedAtMs - b.closedAtMs);

  const typeSamples = new Map<string, number[]>();
  for (const item of items) {
    const list = typeSamples.get(item.typeId) ?? [];
    list.push(item.sample);
    typeSamples.set(item.typeId, list);
  }

  const result = new Map<string, number>();
  for (const [typeId, samples] of typeSamples.entries()) {
    result.set(typeId, typePace(samples));
  }
  return result;
}

export function filterAndSortBacklog(
  tasks: readonly RawBacklogTask[],
  scheduledTaskIds: ReadonlySet<string>,
  typePaces: ReadonlyMap<string, number>,
): BacklogTaskItem[] {
  const unscheduled = tasks.filter((task) => !scheduledTaskIds.has(task.id));

  const items: BacklogTaskItem[] = unscheduled.map((task) => ({
    id: task.id,
    typeId: task.type_id,
    typeName: task.task_types.name,
    typeColor: task.task_types.color,
    typeEnergy: task.task_types.energy,
    isOneOff: task.task_types.is_one_off,
    priority: task.priority as Priority,
    fixation: task.fixation,
    notes: task.notes,
    estimateMinutes: task.estimate_minutes,
    sessionMinutes: task.session_minutes,
    deadline: task.deadline,
    createdAt: task.created_at,
    typePace: typePaces.get(task.type_id) ?? TYPE_PACE_SEED,
  }));

  return items.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}
