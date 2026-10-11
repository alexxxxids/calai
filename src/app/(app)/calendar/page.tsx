import 'server-only';

import type { Metadata } from 'next';

import { listUnclosedBlocks } from '@/features/blocks/queries';
import { CalendarPageContent } from '@/features/calendar/components/calendar-page-content';
import { getProfile } from '@/features/profile/queries';
import { listTaskTypes } from '@/features/task-types/queries';
import { listBacklog } from '@/features/tasks/queries';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Kalendarz',
};

const TIME_SLICE_LENGTH = 5;
const DEFAULT_WORK_START = '08:00';
const DEFAULT_TIMEZONE = 'Europe/Warsaw';

function parseWorkStart(dayStart: string | null | undefined): string {
  if (!dayStart || dayStart.length < TIME_SLICE_LENGTH) {
    return DEFAULT_WORK_START;
  }
  return dayStart.slice(0, TIME_SLICE_LENGTH);
}

export default async function CalendarPage() {
  const { user } = await requireUser();
  const supabase = await createClient();

  const [profile, taskTypes, tasks, unclosedBlocks] = await Promise.all([
    getProfile(supabase, user.id),
    listTaskTypes(supabase, user.id),
    listBacklog(supabase, user.id),
    listUnclosedBlocks(supabase, user.id),
  ]);

  const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const workStart = parseWorkStart(profile?.day_start);

  return (
    <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
      <CalendarPageContent
        tasks={tasks}
        taskTypes={taskTypes}
        unclosedBlocks={unclosedBlocks}
        timeZone={timeZone}
        workStart={workStart}
      />
    </main>
  );
}
