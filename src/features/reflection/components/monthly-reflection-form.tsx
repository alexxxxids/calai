'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from 'lucide-react';
import { saveMonthlyReflection } from '../actions';
import { MAX_MONTHLY_TEXT_LENGTH } from '../schemas';
import type { MonthlyReflectionRow, MonthlyReflectionState } from '../types';
import { MonthlyTypeStats } from './monthly-type-stats';

export interface MonthlyReflectionFormProps {
  readonly state: MonthlyReflectionState;
}

interface MonthlyFormValues {
  readonly wentWell: string;
  readonly wentBadly: string;
  readonly typesReview: string;
  readonly goalsNext: string;
  readonly prioritiesChange: string;
}

function getInitialValues(reflection: MonthlyReflectionRow | null): MonthlyFormValues {
  if (!reflection) {
    return {
      wentWell: '',
      wentBadly: '',
      typesReview: '',
      goalsNext: '',
      prioritiesChange: '',
    };
  }
  return {
    wentWell: reflection.went_well ?? '',
    wentBadly: reflection.went_badly ?? '',
    typesReview: reflection.types_review ?? '',
    goalsNext: reflection.goals_next ?? '',
    prioritiesChange: reflection.priorities_change ?? '',
  };
}

interface MonthlyFieldProps {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
}

function MonthlyField({ id, label, description, value, onChange, disabled }: MonthlyFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor={id} className="text-sm font-medium">
            {label}
          </Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0 self-start">
          {value.length} / {MAX_MONTHLY_TEXT_LENGTH}
        </span>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX_MONTHLY_TEXT_LENGTH}
        rows={3}
        disabled={disabled}
        className="resize-none text-sm"
      />
    </div>
  );
}

interface MonthlyFormFieldsProps {
  readonly form: MonthlyFormValues;
  readonly onChange: (updater: (prev: MonthlyFormValues) => MonthlyFormValues) => void;
  readonly disabled: boolean;
}

function MonthlyFormFields({ form, onChange, disabled }: MonthlyFormFieldsProps) {
  return (
    <>
      <MonthlyField
        id="monthly-went-well"
        label="Co poszło dobrze"
        description="Które techniki planowania, projekty lub nawyki przyniosły najlepsze rezultaty?"
        value={form.wentWell}
        onChange={(v) => onChange((prev) => ({ ...prev, wentWell: v }))}
        disabled={disabled}
      />
      <MonthlyField
        id="monthly-went-badly"
        label="Co nie zadziałało"
        description="Co sprawiło trudność, gdzie pojawiło się przeciążenie lub opóźnienia?"
        value={form.wentBadly}
        onChange={(v) => onChange((prev) => ({ ...prev, wentBadly: v }))}
        disabled={disabled}
      />
      <MonthlyField
        id="monthly-types-review"
        label="Przegląd typów zadań"
        description="Czy kategorie i wagi energetyczne wciąż odpowiadają rzeczywistemu wysiłkowi?"
        value={form.typesReview}
        onChange={(v) => onChange((prev) => ({ ...prev, typesReview: v }))}
        disabled={disabled}
      />
      <MonthlyField
        id="monthly-goals-next"
        label="Cele na kolejny miesiąc"
        description="Główne priorytety i kamienie milowe w nauce oraz projektach."
        value={form.goalsNext}
        onChange={(v) => onChange((prev) => ({ ...prev, goalsNext: v }))}
        disabled={disabled}
      />
      <MonthlyField
        id="monthly-priorities-change"
        label="Zmiana priorytetów"
        description="Czy któreś zadania należy odłożyć, zdelegować lub anulować?"
        value={form.prioritiesChange}
        onChange={(v) => onChange((prev) => ({ ...prev, prioritiesChange: v }))}
        disabled={disabled}
      />
    </>
  );
}

interface MonthlyCardProps {
  readonly activeMonth: string;
  readonly initialReflection: MonthlyReflectionRow | null;
}

function MonthlyFormCard({ activeMonth, initialReflection }: MonthlyCardProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [form, setForm] = useState<MonthlyFormValues>(() => getInitialValues(initialReflection));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    startTransition(async () => {
      const result = await saveMonthlyReflection({
        month: activeMonth,
        wentWell: form.wentWell,
        wentBadly: form.wentBadly,
        typesReview: form.typesReview,
        goalsNext: form.goalsNext,
        prioritiesChange: form.prioritiesChange,
      });

      if (result.ok) {
        toast.success('Zapisano refleksję miesięczną.');
      } else {
        setServerError(result.error);
        toast.error(result.error);
      }
    });
  };

  return (
    <Card className="bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Wnioski jakościowe ({activeMonth})
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Odpowiedz na pytania podsumowujące miesiąc. Pola są opcjonalne.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {initialReflection ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg border border-border">
              <CheckCircle2Icon className="size-4 text-primary shrink-0" />
              <span>Wypełniono podsumowanie dla tego miesiąca. Możesz je zaktualizować.</span>
            </div>
          ) : null}

          {serverError ? (
            <Alert variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          <MonthlyFormFields form={form} onChange={setForm} disabled={isPending} />
        </CardContent>

        <CardFooter className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending} className="gap-2 min-w-36">
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Zapisywanie...
              </>
            ) : (
              'Zapisz podsumowanie'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function MonthlyReflectionForm({ state }: MonthlyReflectionFormProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'current' | 'previous'>('current');

  const activeMonth = selectedPeriod === 'current' ? state.currentMonth : state.previousMonth;
  const activeReflection =
    selectedPeriod === 'current' ? state.currentReflection : state.previousReflection;
  const activeStats = selectedPeriod === 'current' ? state.currentStats : state.previousStats;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Podsumowanie miesięczne
          </h2>
          <p className="text-sm text-muted-foreground">
            Przegląd strategiczny nawyków, obciążenia oraz rewizja celów (FR-101).
          </p>
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted border border-border shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSelectedPeriod('current')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              selectedPeriod === 'current'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Bieżący miesiąc ({state.currentMonth})
          </button>
          <button
            type="button"
            onClick={() => setSelectedPeriod('previous')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              selectedPeriod === 'previous'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Poprzedni ({state.previousMonth})
          </button>
        </div>
      </div>

      <MonthlyTypeStats stats={activeStats} monthLabel={activeMonth} />

      <MonthlyFormCard
        key={activeMonth}
        activeMonth={activeMonth}
        initialReflection={activeReflection}
      />
    </div>
  );
}
