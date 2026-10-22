'use client';

import { CalendarIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { addSubscription, removeSubscription, syncSubscriptionAction } from '../actions';
import type { CalendarSubscriptionWithDetails } from '../queries';
import { AddSubscriptionDialog, type TaskTypeOption } from './add-subscription-dialog';
import { SubscriptionItemRow } from './subscription-item-row';

export type { TaskTypeOption };

export interface CalendarSubscriptionsSettingsProps {
  readonly initialSubscriptions?: ReadonlyArray<CalendarSubscriptionWithDetails>;
  readonly taskTypes: ReadonlyArray<TaskTypeOption>;
}

function SubscriptionsCardHeader({
  taskTypes,
  onAdd,
  isPending,
}: {
  readonly taskTypes: ReadonlyArray<TaskTypeOption>;
  readonly onAdd: (data: { name: string; url: string; typeId: string }) => Promise<boolean>;
  readonly isPending: boolean;
}) {
  return (
    <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="size-5" aria-hidden="true" />
          Subskrypcje kalendarza (import iCal)
        </CardTitle>
        <CardDescription>
          Subskrybuj zewnętrzne kalendarze w formacie iCal (np. USOS, Google Calendar, Outlook).
          Zaimportowane wydarzenia automatycznie zablokują czas w Twoim planie.
        </CardDescription>
      </div>
      <div className="shrink-0">
        <AddSubscriptionDialog
          taskTypes={taskTypes}
          onAdd={onAdd}
          isPending={isPending}
        />
      </div>
    </CardHeader>
  );
}

function SubscriptionsList({
  subscriptions,
  onSync,
  onDelete,
  syncingId,
  deletingId,
}: {
  readonly subscriptions: ReadonlyArray<CalendarSubscriptionWithDetails>;
  readonly onSync: (id: string) => void;
  readonly onDelete: (id: string) => void;
  readonly syncingId: string | null;
  readonly deletingId: string | null;
}) {
  if (subscriptions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Nie masz jeszcze żadnych subskrypcji kalendarza
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {subscriptions.map((sub) => (
        <SubscriptionItemRow
          key={sub.id}
          subscription={sub}
          onSync={onSync}
          onDelete={onDelete}
          isSyncing={syncingId === sub.id}
          isDeleting={deletingId === sub.id}
        />
      ))}
    </div>
  );
}

export function CalendarSubscriptionsSettings({
  initialSubscriptions,
  taskTypes,
}: CalendarSubscriptionsSettingsProps) {
  const router = useRouter();
  const [prevInitial, setPrevInitial] = useState(initialSubscriptions);
  const [subscriptions, setSubscriptions] = useState<ReadonlyArray<CalendarSubscriptionWithDetails>>(
    initialSubscriptions ?? [],
  );
  const [isPending, startTransition] = useTransition();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (initialSubscriptions !== prevInitial) {
    setPrevInitial(initialSubscriptions);
    setSubscriptions(initialSubscriptions ?? []);
  }

  const handleSync = (id: string) => {
    setSyncingId(id);
    startTransition(async () => {
      try {
        const result = await syncSubscriptionAction({ subscriptionId: id });
        if (result.ok) {
          toast.success(`Zsynchronizowano wydarzenia: ${result.data}`);
          router.refresh();
        } else {
          toast.error(result.error ?? 'Błąd synchronizacji');
        }
      } finally {
        setSyncingId(null);
      }
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      try {
        const result = await removeSubscription({ subscriptionId: id });
        if (result.ok) {
          setSubscriptions((prev) => prev.filter((s) => s.id !== id));
          toast.success('Subskrypcja została usunięta');
          router.refresh();
        } else {
          toast.error(result.error ?? 'Nie udało się usunąć subskrypcji');
        }
      } finally {
        setDeletingId(null);
      }
    });
  };

  const handleAdd = async (data: { name: string; url: string; typeId: string }): Promise<boolean> => {
    const result = await addSubscription(data);
    if (result.ok) {
      toast.success('Dodano subskrypcję kalendarza');
      router.refresh();
      return true;
    }
    toast.error(result.error ?? 'Nie udało się dodać subskrypcji');
    return false;
  };

  return (
    <Card>
      <SubscriptionsCardHeader
        taskTypes={taskTypes}
        onAdd={handleAdd}
        isPending={isPending}
      />
      <CardContent>
        <SubscriptionsList
          subscriptions={subscriptions}
          onSync={handleSync}
          onDelete={handleDelete}
          syncingId={syncingId}
          deletingId={deletingId}
        />
      </CardContent>
    </Card>
  );
}
