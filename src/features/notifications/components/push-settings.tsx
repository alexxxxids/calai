'use client';

import { BellIcon, BellOffIcon, InfoIcon, Loader2Icon } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isCurrentDeviceSubscribed } from '../actions';
import {
  getBrowserPushSubscription,
  isPushSupported,
  subscribeBrowserPush,
  unsubscribeBrowserPush,
} from '../client';

function PushCardHeader() {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <BellIcon className="size-5" aria-hidden="true" />
        Powiadomienia Push
      </CardTitle>
      <CardDescription>
        Otrzymuj przypomnienia 10 minut przed rozpoczęciem zadań, wieczorne podsumowanie dnia oraz
        niedzielną refleksję.
      </CardDescription>
    </CardHeader>
  );
}

function IosPushNotice() {
  return (
    <Alert>
      <InfoIcon className="size-4" aria-hidden="true" />
      <AlertTitle>Urządzenia Apple (iPhone / iPad)</AlertTitle>
      <AlertDescription>
        W systemie iOS powiadomienia Push działają wyłącznie po dodaniu aplikacji do ekranu
        początkowego («Dodaj do ekranu początkowego» w menu Safari).
      </AlertDescription>
    </Alert>
  );
}

interface ToggleButtonProps {
  readonly isSubscribed: boolean;
  readonly isPending: boolean;
  readonly disabled: boolean;
  readonly onToggle: () => void;
}

function PushToggleButton({ isSubscribed, isPending, disabled, onToggle }: ToggleButtonProps) {
  return (
    <Button
      onClick={onToggle}
      disabled={disabled}
      variant={isSubscribed ? 'outline' : 'default'}
    >
      {isPending && <Loader2Icon className="size-4 animate-spin mr-2" aria-hidden="true" />}
      {isSubscribed ? (
        <>
          <BellOffIcon className="size-4 mr-2" aria-hidden="true" />
          Wyłącz powiadomienia
        </>
      ) : (
        <>
          <BellIcon className="size-4 mr-2" aria-hidden="true" />
          Włącz powiadomienia
        </>
      )}
    </Button>
  );
}

export function PushSettings() {
  const [isPending, startTransition] = useTransition();
  const [isSupported] = useState(() => isPushSupported());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let isMounted = true;
    if (isPushSupported()) {
      void getBrowserPushSubscription().then(async (sub) => {
        if (!isMounted) {
          return;
        }
        if (!sub) {
          setIsSubscribed(false);
          return;
        }
        const check = await isCurrentDeviceSubscribed({ endpoint: sub.endpoint });
        if (isMounted) {
          setIsSubscribed(check.ok && check.data.subscribed);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  function handleToggle() {
    startTransition(async () => {
      if (isSubscribed) {
        const result = await unsubscribeBrowserPush();
        if (result.ok) {
          setIsSubscribed(false);
          toast.success('Powiadomienia Push zostały wyłączone.');
        } else {
          toast.error(result.error);
        }
        return;
      }

      if (!vapidKey) {
        toast.error('Brak skonfigurowanego klucza VAPID.');
        return;
      }
      const result = await subscribeBrowserPush(vapidKey);
      if (result.ok) {
        setIsSubscribed(true);
        toast.success('Powiadomienia Push zostały włączone.');
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <PushCardHeader />
      <CardContent className="space-y-4">
        {!isSupported && (
          <Alert variant="destructive">
            <AlertTitle>Brak wsparcia</AlertTitle>
            <AlertDescription>Twoja przeglądarka nie obsługuje powiadomień Push.</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Status powiadomień na tym urządzeniu</p>
            <p className="text-sm text-muted-foreground">
              {isSubscribed ? 'Powiadomienia są aktywne' : 'Powiadomienia są wyłączone'}
            </p>
          </div>
          <PushToggleButton
            isSubscribed={isSubscribed}
            isPending={isPending}
            disabled={isPending || !isSupported || !vapidKey}
            onToggle={handleToggle}
          />
        </div>

        <IosPushNotice />
      </CardContent>
    </Card>
  );
}
