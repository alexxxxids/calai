'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { AlertCircleIcon, CheckIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatMinutes } from '@/lib/format';
import { localCloseBlock } from '@/lib/local-store';
import type { UnclosedBlockItem } from '@/features/blocks/types';
import type { ActionResult } from '@/lib/action-result';
import {
  DEFAULT_WARSAW_TIMEZONE,
  formatEventTimeRange,
  MIN_ACTUAL_MINUTES,
} from './calendar-helpers';

export interface ExecuteCloseBlockParams {
  readonly blockId: string;
  readonly status: 'done' | 'missed';
  readonly actualMinutes?: number;
  readonly closeAction?: (input: {
    readonly blockId: string;
    readonly status: 'done' | 'missed';
    readonly actualMinutes?: number;
  }) => Promise<ActionResult<unknown>>;
  readonly onBlockClosed?: (blockId: string) => void;
}

export async function executeCloseDayBlock(params: ExecuteCloseBlockParams): Promise<boolean> {
  const action = params.closeAction ?? (async (input) => localCloseBlock(input));
  try {
    const payload =
      params.status === 'done'
        ? {
            blockId: params.blockId,
            status: 'done' as const,
            actualMinutes: params.actualMinutes ?? MIN_ACTUAL_MINUTES,
          }
        : {
            blockId: params.blockId,
            status: 'missed' as const,
          };
    const res = await action(payload);
    if (res.ok) {
      const msg =
        params.status === 'done'
          ? 'Blok oznaczony jako zrobiony'
          : 'Blok oznaczony jako nie zrobiony';
      toast.success(msg);
      params.onBlockClosed?.(params.blockId);
      return true;
    }
    toast.error(res.error ?? 'Nie udało się rozliczyć bloku');
    return false;
  } catch {
    toast.error('Błąd połączenia');
    return false;
  }
}

interface CloseDayBannerHeaderProps {
  readonly count: number;
}

function CloseDayBannerHeader({ count }: CloseDayBannerHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <AlertCircleIcon
        className="size-5 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <div>
        <h3 className="font-heading text-sm font-semibold text-foreground">
          Niezamknięte bloki ({count})
        </h3>
        <p className="text-xs text-muted-foreground">
          Rozlicz zakończone bloki, aby zaktualizować statystyki i kalibrację tempa.
        </p>
      </div>
    </div>
  );
}

interface CloseDayBlockItemRowProps {
  readonly block: UnclosedBlockItem;
  readonly timeZone: string;
  readonly isPending: boolean;
  readonly onDone: (block: UnclosedBlockItem) => void;
  readonly onMiss: (block: UnclosedBlockItem) => void;
}

function CloseDayBlockItemRow({
  block,
  timeZone,
  isPending,
  onDone,
  onMiss,
}: CloseDayBlockItemRowProps) {
  const timeRange = formatEventTimeRange(
    new Date(block.startsAt),
    new Date(block.endsAt),
    timeZone,
  );
  const formattedWork = formatMinutes(block.workMinutes);

  return (
    <div
      data-testid={`unclosed-block-${block.id}`}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-amber-500/20 bg-background/60 p-2.5 text-xs shadow-2xs"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="size-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
          style={{ backgroundColor: block.typeColor }}
          aria-hidden="true"
        />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-foreground truncate">{block.typeName}</span>
            {block.notes && (
              <span className="text-muted-foreground truncate max-w-48">({block.notes})</span>
            )}
          </div>
          <span className="text-muted-foreground">
            {timeRange} • {formattedWork}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs border-amber-500/30 hover:bg-amber-500/10 text-foreground"
          disabled={isPending}
          onClick={() => onDone(block)}
          aria-label={`Oznacz jako zrobione: ${block.typeName}`}
        >
          <CheckIcon className="size-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
          Zrobione
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          disabled={isPending}
          onClick={() => onMiss(block)}
          aria-label={`Oznacz jako nie zrobione: ${block.typeName}`}
        >
          <XIcon className="size-3.5 mr-1" />
          Nie zrobione
        </Button>
      </div>
    </div>
  );
}

export interface CloseDayBannerProps {
  readonly unclosedBlocks: readonly UnclosedBlockItem[];
  readonly timeZone?: string;
  readonly onBlockClosed?: (blockId: string) => void;
  readonly closeAction?: ExecuteCloseBlockParams['closeAction'];
  readonly pendingBlockId?: string | null;
}

export function CloseDayBanner({
  unclosedBlocks,
  timeZone = DEFAULT_WARSAW_TIMEZONE,
  onBlockClosed,
  closeAction,
  pendingBlockId: propsPendingBlockId,
}: CloseDayBannerProps) {
  const [internalPendingBlockId, setInternalPendingBlockId] = React.useState<string | null>(null);
  const pendingBlockId =
    propsPendingBlockId !== undefined ? propsPendingBlockId : internalPendingBlockId;

  if (unclosedBlocks.length === 0) {
    return null;
  }

  const handleDone = async (b: UnclosedBlockItem) => {
    if (pendingBlockId) {
      return;
    }
    setInternalPendingBlockId(b.id);
    try {
      await executeCloseDayBlock({
        blockId: b.id,
        status: 'done',
        actualMinutes: Math.max(MIN_ACTUAL_MINUTES, b.workMinutes),
        closeAction,
        onBlockClosed,
      });
    } finally {
      setInternalPendingBlockId(null);
    }
  };

  const handleMiss = async (b: UnclosedBlockItem) => {
    if (pendingBlockId) {
      return;
    }
    setInternalPendingBlockId(b.id);
    try {
      await executeCloseDayBlock({
        blockId: b.id,
        status: 'missed',
        closeAction,
        onBlockClosed,
      });
    } finally {
      setInternalPendingBlockId(null);
    }
  };

  return (
    <div
      role="region"
      aria-label="Niezamknięte bloki"
      className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 md:p-4 text-foreground shadow-xs"
    >
      <CloseDayBannerHeader count={unclosedBlocks.length} />
      <div className="flex flex-col gap-2">
        {unclosedBlocks.map((block) => (
          <CloseDayBlockItemRow
            key={block.id}
            block={block}
            timeZone={timeZone}
            isPending={Boolean(pendingBlockId)}
            onDone={handleDone}
            onMiss={handleMiss}
          />
        ))}
      </div>
    </div>
  );
}
