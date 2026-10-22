import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  generateIcsFeed,
  getFeedDateRange,
  REST_FALLBACK_TITLE,
  TASK_FALLBACK_TITLE,
  type FeedBlockItem,
} from './feed-generator';

interface RawBlockRow {
  readonly id: string;
  readonly task_id: string | null;
  readonly source: Database['public']['Enums']['block_source'];
  readonly starts_at: string;
  readonly ends_at: string;
  readonly status: Database['public']['Enums']['block_status'];
  readonly tasks: {
    readonly notes: string | null;
    readonly task_types: {
      readonly name: string;
    } | null;
  } | null;
}

/**
 * Builds the iCal VCALENDAR string for the given user, covering planned and done
 * blocks from 14 days in the past to 60 days in the future.
 */
export async function buildFeed(
  admin: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<string> {
  const range = getFeedDateRange(now);

  const { data, error } = await admin
    .from('blocks')
    .select('id, task_id, source, starts_at, ends_at, status, tasks(notes, task_types(name))')
    .eq('user_id', userId)
    .in('status', ['planned', 'done'])
    .gte('ends_at', range.start.toISOString())
    .lte('starts_at', range.end.toISOString())
    .order('starts_at', { ascending: true });

  if (error) {
    console.error('[buildFeed] Database error querying blocks:', error);
    throw new Error(`Nie udało się pobrać bloków kalendarza: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawBlockRow[];

  const blocks: FeedBlockItem[] = rows.map((row) => {
    const isRest = row.source === 'rest' || !row.task_id;
    const taskTypeName = row.tasks?.task_types?.name;
    const typeName = isRest ? REST_FALLBACK_TITLE : (taskTypeName ?? TASK_FALLBACK_TITLE);

    return {
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status as 'planned' | 'done',
      typeName,
      notes: row.tasks?.notes ?? null,
    };
  });

  return generateIcsFeed(blocks);
}
