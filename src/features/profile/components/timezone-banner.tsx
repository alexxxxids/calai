'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { GlobeIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { updateTimezone } from '@/features/profile/actions';
import { shouldShowTimezoneBanner } from '@/features/profile/schemas';

interface TimezoneBannerProps {
  readonly profileTimezone: string;
}

function subscribe() {
  return () => {
    // browser timezone does not emit DOM events
  };
}

function getClientTimezoneSnapshot(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== 'Factory') {
      return tz;
    }
    return null;
  } catch {
    return null;
  }
}

function getServerTimezoneSnapshot(): string | null {
  return null;
}


export function TimezoneBanner({ profileTimezone }: TimezoneBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [isDismissed, setIsDismissed] = React.useState(false);

  const browserTimezone = React.useSyncExternalStore(
    subscribe,
    getClientTimezoneSnapshot,
    getServerTimezoneSnapshot
  );

  if (!shouldShowTimezoneBanner(browserTimezone, profileTimezone, isDismissed)) {
    return null;
  }

  const handleUpdate = () => {
    if (!browserTimezone) return;

    startTransition(async () => {
      const res = await updateTimezone({ timezone: browserTimezone });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Strefa czasowa została zmieniona na ${browserTimezone}`);
      router.refresh();
    });
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-3 border-b bg-amber-500/10 px-4 py-2.5 text-sm text-foreground dark:bg-amber-500/15"
    >
      <div className="flex items-center gap-2">
        <GlobeIcon
          className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <span>
          Twoja przeglądarka wskazuje strefę <strong>{browserTimezone}</strong>, a w
          profilu masz <strong>{profileTimezone}</strong>.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleUpdate}
          disabled={isPending}
          className="h-7 text-xs border-amber-500/30 hover:bg-amber-500/20"
        >
          {isPending ? 'Zmienianie...' : `Zmień na ${browserTimezone}`}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsDismissed(true)}
          className="size-7 text-muted-foreground hover:text-foreground"
          aria-label="Zamknij powiadomienie o strefie czasowej"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </aside>
  );
}
