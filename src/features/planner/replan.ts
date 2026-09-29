import 'server-only';

import { planSchedule } from '@/domain/scheduler';
import type { PlannedBlock } from '@/domain/types';
import type { ServerSupabase } from '@/lib/supabase/server';
import type { Json } from '@/types/database.types';

import { buildPlannerInput } from './build-input';
import { loadPlannerData } from './queries';
import type { ReplanResult } from './types';

const CONCURRENCY_ERROR_CODE = '23P01';
const MAX_REPLAN_ATTEMPTS = 2;

interface NewDbBlock {
  readonly task_id: string | null;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly work_minutes: number;
  readonly source: PlannedBlock['source'];
}

function mapBlocksToDb(blocks: readonly PlannedBlock[]): NewDbBlock[] {
  return blocks.map((block) => ({
    task_id: block.taskId,
    starts_at: new Date(block.interval.start).toISOString(),
    ends_at: new Date(block.interval.end).toISOString(),
    work_minutes: block.workMinutes,
    source: block.source,
  }));
}

export async function replanForUser(
  supabase: ServerSupabase,
  userId: string,
  now: Date,
): Promise<ReplanResult> {
  for (let attempt = 1; attempt <= MAX_REPLAN_ATTEMPTS; attempt++) {
    const data = await loadPlannerData(supabase, userId);
    const { input, removeBlockIds } = buildPlannerInput(data, now);
    const plannerResult = planSchedule(input);

    const newBlocks = mapBlocksToDb(plannerResult.blocks);
    // Json conversion: NewDbBlock matches Json schema for apply_plan RPC
    const { error } = await supabase.rpc('apply_plan', {
      p_remove_ids: [...removeBlockIds],
      p_new_blocks: newBlocks as unknown as Json,
    });

    if (!error) {
      return {
        placed: plannerResult.blocks.length,
        unscheduled: plannerResult.unscheduled,
      };
    }

    if (error.code === CONCURRENCY_ERROR_CODE) {
      if (attempt === MAX_REPLAN_ATTEMPTS) {
        throw new Error('Plan się zmienił, spróbuj ponownie');
      }
      continue;
    }

    throw new Error(`Błąd zapisu planu: ${error.message}`);
  }

  throw new Error('Plan się zmienił, spróbuj ponownie');
}
