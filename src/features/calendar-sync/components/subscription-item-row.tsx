'use client';

import { AlertCircleIcon, Loader2Icon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CalendarSubscriptionWithDetails } from '../queries';

const DATE_SLICE_END = 10;
const TIME_SLICE_START = 11;
const TIME_SLICE_END = 16;

export interface SubscriptionItemRowProps {
  readonly subscription: CalendarSubscriptionWithDetails;
  readonly onSync: (id: string) => void;
  readonly onDelete: (id: string) => void;
  readonly isSyncing?: boolean;
  readonly isDeleting?: boolean;
}

function DeleteSubscriptionDialog({
  name,
  onConfirm,
  disabled,
}: {
  readonly name: string;
  readonly onConfirm: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2Icon className="size-4 mr-1.5" aria-hidden="true" />
          Usuń
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usunąć subskrypcję kalendarza?</AlertDialogTitle>
          <AlertDialogDescription>
            Wszystkie wydarzenia zaimportowane z subskrypcji «{name}» zostaną trwale usunięte z
            Twojego kalendarza.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Usuń
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SubscriptionMetaDetails({
  subscription,
}: {
  readonly subscription: CalendarSubscriptionWithDetails;
}) {
  const syncLabel = subscription.lastSyncedAt
    ? `Zsynchronizowano: ${subscription.lastSyncedAt.slice(0, DATE_SLICE_END)} ${subscription.lastSyncedAt.slice(TIME_SLICE_START, TIME_SLICE_END)}`
    : 'Nigdy niesynchronizowano';

  return (
    <div className="min-w-0 space-y-1.5 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-foreground truncate">{subscription.name}</span>
        <Badge variant="outline" className="text-xs flex items-center gap-1.5">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: subscription.typeColor }}
            aria-hidden="true"
          />
          {subscription.typeName}
        </Badge>
        {subscription.lastError && (
          <Badge
            variant="destructive"
            className="text-xs flex items-center gap-1 max-w-md truncate"
            title={subscription.lastError}
          >
            <AlertCircleIcon className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{subscription.lastError}</span>
          </Badge>
        )}
      </div>
      <p className="truncate font-mono text-xs text-muted-foreground">{subscription.url}</p>
      <p className="text-xs text-muted-foreground">{syncLabel}</p>
    </div>
  );
}

export function SubscriptionItemRow({
  subscription,
  onSync,
  onDelete,
  isSyncing = false,
  isDeleting = false,
}: SubscriptionItemRowProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
      <SubscriptionMetaDetails subscription={subscription} />
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSync(subscription.id)}
          disabled={isSyncing || isDeleting}
          aria-label={`Synchronizuj ${subscription.name}`}
        >
          {isSyncing ? (
            <Loader2Icon className="size-4 animate-spin mr-1.5" aria-hidden="true" />
          ) : (
            <RefreshCwIcon className="size-4 mr-1.5" aria-hidden="true" />
          )}
          Synchronizuj
        </Button>
        <DeleteSubscriptionDialog
          name={subscription.name}
          onConfirm={() => onDelete(subscription.id)}
          disabled={isSyncing || isDeleting}
        />
      </div>
    </div>
  );
}
