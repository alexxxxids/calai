'use client';

import {
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  InfoIcon,
  Loader2Icon,
  RefreshCwIcon,
} from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useBrowserValue } from '@/components/app/use-browser-value';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getFeedTokenAction, rotateFeedToken } from '../actions';

const COPIED_TIMEOUT_MS = 2000;

export interface CalendarFeedSettingsProps {
  readonly initialToken?: string | null;
}

function FeedCardHeader() {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <CalendarIcon className="size-5" aria-hidden="true" />
        Eksport kalendarza (iCal)
      </CardTitle>
      <CardDescription>
        Zasubskrybuj swoje zaplanowane i wykonane bloki zadań w Google Calendar, Apple Calendar
        lub innym programie obsługującym format iCal.
      </CardDescription>
    </CardHeader>
  );
}

function FeedLoadingState() {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
      Sprawdzanie stanu linku kalendarza...
    </div>
  );
}

function FeedUrlCopyInput({
  fullUrl,
  copied,
  onCopy,
}: {
  readonly fullUrl: string;
  readonly copied: boolean;
  readonly onCopy: () => void;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor="calendar-feed-url"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Twój prywatny adres subskrypcji
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="calendar-feed-url"
          readOnly
          value={fullUrl}
          className="font-mono text-xs"
          aria-label="Prywatny adres subskrypcji kalendarza"
        />
        <Button
          type="button"
          variant="outline"
          onClick={onCopy}
          className="shrink-0"
        >
          {copied ? (
            <>
              <CheckIcon className="size-4 mr-2" aria-hidden="true" />
              Skopiowano
            </>
          ) : (
            <>
              <CopyIcon className="size-4 mr-2" aria-hidden="true" />
              Kopiuj link
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function GoogleCalendarGuide() {
  return (
    <Alert>
      <InfoIcon className="size-4" aria-hidden="true" />
      <AlertTitle>Jak dodać do Google Calendar?</AlertTitle>
      <AlertDescription className="text-xs space-y-1">
        <p>1. Otwórz <strong>Google Calendar</strong> na komputerze.</p>
        <p>2. W sekcji <em>Inne kalendarze</em> kliknij <strong>+</strong> → <strong>Z adresu URL</strong>.</p>
        <p>3. Wklej powyższy skopiowany link i zatwierdź.</p>
      </AlertDescription>
    </Alert>
  );
}

function RotateFeedDialogButton({
  isPending,
  onRotate,
}: {
  readonly isPending: boolean;
  readonly onRotate: () => void;
}) {
  return (
    <div className="pt-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            {isPending ? (
              <Loader2Icon className="size-4 animate-spin mr-2" aria-hidden="true" />
            ) : (
              <RefreshCwIcon className="size-4 mr-2" aria-hidden="true" />
            )}
            Wygeneruj nowy link
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wygenerować nowy link do kalendarza?</AlertDialogTitle>
            <AlertDialogDescription>
              Dotychczasowy link natychmiast przestanie działać. Będziesz musiał zaktualizować
              adres subskrypcji w Google Calendar i innych podłączonych aplikacjach.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={onRotate}>
              Wygeneruj nowy link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyFeedNotice({
  isPending,
  onGenerate,
}: {
  readonly isPending: boolean;
  readonly onGenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Nie posiadasz jeszcze wygenerowanego linku do subskrypcji. Kliknij poniższy przycisk,
        aby utworzyć bezpieczny prywatny adres dla Twojego kalendarza.
      </p>
      <Button onClick={onGenerate} disabled={isPending}>
        {isPending && (
          <Loader2Icon className="size-4 animate-spin mr-2" aria-hidden="true" />
        )}
        Wygeneruj link do kalendarza
      </Button>
    </div>
  );
}

function useFeedToken(initialToken?: string | null) {
  const [token, setToken] = useState<string | null>(initialToken ?? null);
  const [isLoading, setIsLoading] = useState(initialToken === undefined);

  useEffect(() => {
    if (initialToken !== undefined) {
      return;
    }

    let isMounted = true;
    void getFeedTokenAction().then((result) => {
      if (!isMounted) {
        return;
      }
      setIsLoading(false);
      if (result.ok && result.data.token) {
        setToken(result.data.token);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [initialToken]);

  return { token, setToken, isLoading };
}

export function CalendarFeedSettings({ initialToken }: CalendarFeedSettingsProps) {
  const { token, setToken, isLoading } = useFeedToken(initialToken);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const origin = useBrowserValue(() => window.location.origin) ?? '';

  const fullUrl = token ? (origin ? `${origin}/api/ics/${token}` : `/api/ics/${token}`) : '';

  const handleCopy = async () => {
    if (!fullUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success('Skopiowano link do schowka');
      setTimeout(() => setCopied(false), COPIED_TIMEOUT_MS);
    } catch {
      toast.error('Nie udało się skopiować linku');
    }
  };

  const handleGenerateOrRotate = () => {
    startTransition(async () => {
      const result = await rotateFeedToken();
      if (result.ok) {
        setToken(result.data.token);
        toast.success(token ? 'Wygenerowano nowy link' : 'Link został utworzony');
      } else {
        toast.error(result.error ?? 'Nie udało się wygenerować linku');
      }
    });
  };

  return (
    <Card>
      <FeedCardHeader />
      <CardContent className="space-y-4">
        {isLoading ? (
          <FeedLoadingState />
        ) : token ? (
          <>
            <FeedUrlCopyInput fullUrl={fullUrl} copied={copied} onCopy={handleCopy} />
            <GoogleCalendarGuide />
            <RotateFeedDialogButton isPending={isPending} onRotate={handleGenerateOrRotate} />
          </>
        ) : (
          <EmptyFeedNotice isPending={isPending} onGenerate={handleGenerateOrRotate} />
        )}
      </CardContent>
    </Card>
  );
}
