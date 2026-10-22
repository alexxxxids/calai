'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteAccountAction, exportUserDataAction } from '../actions';
import { DELETE_ACCOUNT_KEYWORD } from '../schemas';
import type { UserExportData } from '../export-data';

const ISO_DATE_LENGTH = 10;
const JSON_INDENT = 2;
const REVOKE_TIMEOUT_MS = 1000;

function downloadJsonFile(data: UserExportData): void {
  const json = JSON.stringify(data, null, JSON_INDENT);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `calai-export-${data.exportedAt.slice(0, ISO_DATE_LENGTH)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_TIMEOUT_MS);
}

export function ExportDataCard() {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    if (isExporting) {
      return;
    }
    setIsExporting(true);
    try {
      const res = await exportUserDataAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      downloadJsonFile(res.data);
      toast.success('Pobrano eksport danych.');
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd podczas pobierania danych.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Eksport danych</CardTitle>
        <CardDescription>
          Pobierz kopię wszystkich swoich danych w formacie JSON.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? 'Pobieranie...' : 'Pobierz dane (JSON)'}
        </Button>
      </CardContent>
    </Card>
  );
}

export interface DeleteConfirmationFieldProps {
  readonly confirmation: string;
  readonly onChange: (value: string) => void;
  readonly disabled: boolean;
  readonly error: string | null;
}

export function DeleteConfirmationField({
  confirmation,
  onChange,
  disabled,
  error,
}: DeleteConfirmationFieldProps) {
  return (
    <div className="space-y-2 py-2">
      <Label htmlFor="delete-account-confirmation">
        Aby potwierdzić, wpisz USUŃ
      </Label>
      <Input
        id="delete-account-confirmation"
        placeholder="USUŃ"
        value={confirmation}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete="off"
      />
      {error ? (
        <p className="text-sm font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

interface DeleteAccountDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

function useDeleteAccount(onOpenChange: (open: boolean) => void) {
  const [confirmation, setConfirmation] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending) {
      return;
    }
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setConfirmation('');
      setError(null);
    }
  };

  const handleCancel = () => {
    if (isPending) {
      return;
    }
    onOpenChange(false);
    setConfirmation('');
    setError(null);
  };

  const handleDelete = async () => {
    if (confirmation !== DELETE_ACCOUNT_KEYWORD || isPending) {
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const res = await deleteAccountAction({ confirmation });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        setIsPending(false);
        return;
      }
      toast.success('Konto zostało usunięte.');
      window.location.replace('/login');
    } catch {
      const fallbackError = 'Wystąpił nieoczekiwany błąd podczas usuwania konta.';
      setError(fallbackError);
      toast.error(fallbackError);
      setIsPending(false);
    }
  };

  return {
    confirmation,
    setConfirmation,
    error,
    isPending,
    handleOpenChange,
    handleCancel,
    handleDelete,
    canConfirm: confirmation === DELETE_ACCOUNT_KEYWORD && !isPending,
  };
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const {
    confirmation,
    setConfirmation,
    error,
    isPending,
    handleOpenChange,
    handleCancel,
    handleDelete,
    canConfirm,
  } = useDeleteAccount(onOpenChange);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        onEscapeKeyDown={(e: KeyboardEvent) => {
          if (isPending) {
            e.preventDefault();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Usunąć konto?</AlertDialogTitle>
          <AlertDialogDescription>
            Tej operacji nie można cofnąć. Wszystkie Twoje zadania, bloki, nawyki, refleksje
            oraz przesłane pliki zostaną bezpowrotnie usunięte.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <DeleteConfirmationField
          confirmation={confirmation}
          onChange={setConfirmation}
          disabled={isPending}
          error={error}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} onClick={handleCancel}>
            Anuluj
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canConfirm}
          >
            {isPending ? 'Usuwanie...' : 'Usuń konto trwale'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteAccountCard() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Usuwanie konta</CardTitle>
          <CardDescription>
            Trwałe usunięcie konta i wszystkich powiązanych danych.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Usuń konto
          </Button>
        </CardContent>
      </Card>
      <DeleteAccountDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function AccountSettings() {
  return (
    <div className="space-y-6">
      <ExportDataCard />
      <DeleteAccountCard />
    </div>
  );
}
