'use client';

import * as React from 'react';
import { AppShell } from '@/components/app/app-shell';
import { CalendarPageContent } from '@/features/calendar/components/calendar-page-content';
import {
  getCalendarSnapshot,
  getLocalStoreVersion,
  subscribeLocalStore,
} from '@/lib/local-store';
import { DEFAULT_TIMEZONE } from '@/lib/local-store-seed';

const DEFAULT_WORK_START = '08:00';
const emptySubscribe = () => () => undefined;

export function CalendarWorkspace() {
  const isClient = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const storeVersion = React.useSyncExternalStore(
    subscribeLocalStore,
    getLocalStoreVersion,
    () => 0,
  );

  const snapshot = React.useMemo(() => {
    void storeVersion;
    return isClient ? getCalendarSnapshot() : null;
  }, [isClient, storeVersion]);

  return (
    <AppShell>
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {snapshot ? (
          <CalendarPageContent
            tasks={snapshot.tasks}
            taskTypes={snapshot.taskTypes}
            unclosedBlocks={snapshot.unclosedBlocks}
            recurringEvents={snapshot.recurringEvents}
            timeZone={DEFAULT_TIMEZONE}
            workStart={DEFAULT_WORK_START}
          />
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Ładowanie kalendarza...
          </div>
        )}
      </div>
    </AppShell>
  );
}
