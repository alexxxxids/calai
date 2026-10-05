'use client';

import * as React from 'react';
import { CheckIcon, PinIcon, XIcon } from 'lucide-react';

export interface CalendarEventContentProps {
  readonly title: string;
  readonly timeText?: string;
  readonly pinned?: boolean;
  readonly status?: string | null;
  readonly kind?: string;
}

export function getEventVisualClasses(status?: string | null, kind?: string): string {
  if (kind === 'recurring') {
    return 'border-l-2 border-primary/60';
  }
  if (kind === 'external') {
    return 'border-l-2 border-muted-foreground/60 opacity-90';
  }
  if (status === 'done') {
    return 'line-through opacity-75';
  }
  if (status === 'missed') {
    return 'opacity-60 text-muted-foreground line-through';
  }
  return '';
}

export function CalendarEventContent({
  title,
  timeText,
  pinned = false,
  status = null,
  kind = 'block',
}: CalendarEventContentProps) {
  const isDone = status === 'done';
  const isMissed = status === 'missed';
  const visualClasses = getEventVisualClasses(status, kind);

  return (
    <div
      className={`flex flex-col h-full w-full overflow-hidden px-1 py-0.5 text-xs leading-tight ${visualClasses}`}
      data-kind={kind}
      data-status={status ?? undefined}
    >
      <div className="flex items-center gap-1 min-w-0">
        {pinned && (
          <PinIcon
            className="size-3 shrink-0 text-foreground/80"
            aria-label="Przypięty"
          />
        )}
        {isDone && (
          <CheckIcon
            className="size-3 shrink-0 text-foreground/80"
            aria-label="Wykonano"
          />
        )}
        {isMissed && (
          <XIcon
            className="size-3 shrink-0 text-foreground/80"
            aria-label="Pominięto"
          />
        )}
        <span className="font-semibold truncate">{title}</span>
      </div>
      {timeText ? (
        <span className="text-[10px] opacity-80 truncate">{timeText}</span>
      ) : null}
    </div>
  );
}

export function renderCalendarEventContent(info: {
  readonly event: {
    readonly title: string;
    readonly extendedProps: Record<string, unknown>;
  };
  readonly timeText: string;
}): React.ReactElement<CalendarEventContentProps> {
  const ext = info.event.extendedProps;
  return (
    <CalendarEventContent
      title={info.event.title}
      timeText={info.timeText}
      pinned={Boolean(ext.pinned)}
      status={typeof ext.status === 'string' ? ext.status : null}
      kind={typeof ext.kind === 'string' ? ext.kind : undefined}
    />
  );
}
