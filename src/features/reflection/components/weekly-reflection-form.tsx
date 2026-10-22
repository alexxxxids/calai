'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from 'lucide-react';
import { saveWeeklyReflection } from '../actions';
import { MAX_WEEKLY_NOTE_LENGTH } from '../schemas';
import type { WeeklyReflectionRow, WeeklyReflectionState } from '../types';
import { RatingRadioGroup } from './rating-radio-group';

export interface WeeklyReflectionFormProps {
  readonly state: WeeklyReflectionState;
}

const DEFAULT_RATING = 3;

interface FormValues {
  readonly fatigue: number;
  readonly stress: number;
  readonly focus: number;
  readonly distractions: number;
  readonly note: string;
}

function getInitialValues(reflection: WeeklyReflectionRow | null): FormValues {
  if (!reflection) {
    return {
      fatigue: DEFAULT_RATING,
      stress: DEFAULT_RATING,
      focus: DEFAULT_RATING,
      distractions: DEFAULT_RATING,
      note: '',
    };
  }
  return {
    fatigue: reflection.fatigue,
    stress: reflection.stress,
    focus: reflection.focus,
    distractions: reflection.distractions,
    note: reflection.note ?? '',
  };
}

interface WeeklyFormRatingsProps {
  readonly form: FormValues;
  readonly onChange: (updater: (prev: FormValues) => FormValues) => void;
  readonly disabled: boolean;
}

function WeeklyFormRatings({ form, onChange, disabled }: WeeklyFormRatingsProps) {
  return (
    <>
      <RatingRadioGroup
        label="Zmęczenie"
        description="Jak bardzo czujesz się zmęczony fizycznie i psychicznie?"
        name="fatigue"
        value={form.fatigue}
        minLabel="Wypoczęty"
        maxLabel="Wyczerpany"
        onChange={(val) => onChange((prev) => ({ ...prev, fatigue: val }))}
        disabled={disabled}
      />
      <RatingRadioGroup
        label="Stres"
        description="Jaki poziom napięcia lub przytłoczenia odczuwasz?"
        name="stress"
        value={form.stress}
        minLabel="Spokojny"
        maxLabel="Bardzo zestresowany"
        onChange={(val) => onChange((prev) => ({ ...prev, stress: val }))}
        disabled={disabled}
      />
      <RatingRadioGroup
        label="Skupienie"
        description="Jak oceniasz swoją zdolność do głębokiej koncentracji?"
        name="focus"
        minLabel="Rozkojarzony"
        maxLabel="Pełne skupienie"
        value={form.focus}
        onChange={(val) => onChange((prev) => ({ ...prev, focus: val }))}
        disabled={disabled}
      />
      <RatingRadioGroup
        label="Rozpraszacze"
        description="Jak często czynniki zewnętrzne lub powiadomienia przerywały Twoją pracę?"
        name="distractions"
        minLabel="Brak rozproszeń"
        maxLabel="Ciągłe rozpraszanie"
        value={form.distractions}
        onChange={(val) => onChange((prev) => ({ ...prev, distractions: val }))}
        disabled={disabled}
      />
    </>
  );
}

interface WeeklyFormContentProps {
  readonly weekStart: string;
  readonly initialReflection: WeeklyReflectionRow | null;
}

function WeeklyFormContent({ weekStart, initialReflection }: WeeklyFormContentProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(() => getInitialValues(initialReflection));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    startTransition(async () => {
      const result = await saveWeeklyReflection({
        weekStart,
        fatigue: form.fatigue,
        stress: form.stress,
        focus: form.focus,
        distractions: form.distractions,
        note: form.note,
      });

      if (result.ok) {
        toast.success('Zapisano refleksję tygodniową.');
      } else {
        setServerError(result.error);
        toast.error(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-6">
        {initialReflection ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg border border-border">
            <CheckCircle2Icon className="size-4 text-primary shrink-0" />
            <span>
              Wypełniono tę ankietę. Możesz zaktualizować swoje odpowiedzi — plan zostanie przeliczony.
            </span>
          </div>
        ) : null}

        {serverError ? (
          <Alert variant="destructive">
            <AlertCircleIcon className="size-4" />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <WeeklyFormRatings form={form} onChange={setForm} disabled={isPending} />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="weekly-note" className="text-sm font-medium">
              Notatka (opcjonalnie)
            </Label>
            <span className="text-xs text-muted-foreground">
              {form.note.length} / {MAX_WEEKLY_NOTE_LENGTH}
            </span>
          </div>
          <Textarea
            id="weekly-note"
            value={form.note}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            placeholder="Wnioski z tego tygodnia, co wpłynęło na tempo..."
            maxLength={MAX_WEEKLY_NOTE_LENGTH}
            rows={3}
            disabled={isPending}
            className="resize-none"
          />
        </div>
      </CardContent>

      <CardFooter className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending} className="gap-2 min-w-32">
          {isPending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Zapisywanie...
            </>
          ) : (
            'Zapisz refleksję'
          )}
        </Button>
      </CardFooter>
    </form>
  );
}

export function WeeklyReflectionForm({ state }: WeeklyReflectionFormProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'current' | 'previous'>('current');

  const activeWeekStart =
    selectedPeriod === 'current' ? state.currentWeek : state.previousWeek;
  const activeReflection =
    selectedPeriod === 'current' ? state.currentReflection : state.previousReflection;

  return (
    <Card className="max-w-2xl mx-auto bg-card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Refleksja tygodniowa</CardTitle>
            <CardDescription className="text-sm mt-0.5">
              Ankieta wpływa na mnożnik stresu i planowanie przerw regeneracyjnych (FR-62, FR-100).
            </CardDescription>
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
              Bieżący tydzień ({state.currentWeek})
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
              Poprzedni ({state.previousWeek})
            </button>
          </div>
        </div>
      </CardHeader>

      <WeeklyFormContent
        key={activeWeekStart}
        weekStart={activeWeekStart}
        initialReflection={activeReflection}
      />
    </Card>
  );
}
