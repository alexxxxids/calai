'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LocalDate } from '@/domain/types';
import { confirmTimetable } from '@/features/ai/actions';
import {
  AiConsentStep, AiFileUploadStep, AiLoadingStep, hasAiConsent, TimetableEventRow,
} from '@/features/ai/components/ai-dialog-helpers';
import type { TimetableDraft, TimetableEvent } from '@/features/ai/schemas';
import {
  AI_UPLOAD_BUCKET, isAiMimeType, uploadPath,
} from '@/features/ai/uploads';
import { createClient } from '@/lib/supabase/client';

export const DEFAULT_NEW_EVENT_WEEKDAY = 1;
export const DEFAULT_NEW_EVENT_START = '08:00';
export const DEFAULT_NEW_EVENT_END = '08:45';
export const TIMETABLE_IMPORTED_SUCCESS_MESSAGE = 'Plan lekcji zapisany';
const TIMETABLE_API_URL = '/api/ai/timetable';
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

type TimetableStep = 'consent' | 'upload' | 'loading' | 'review';

const STEP_DESCRIPTIONS: Record<TimetableStep, string> = {
  consent: 'Zgoda na analizę zdjęcia planu lekcji przez model AI.',
  upload: 'Wybierz zdjęcie lub zrzut ekranu planu lekcji.',
  loading: 'Trwa rozpoznawanie zajęć z planu lekcji.',
  review: 'Sprawdź rozpoznane lekcje i zatwierdź regularny grafik.',
};

export interface TimetableImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTypeId: string;
  onImported?: (count: number) => void;
}

function updateEventField<K extends keyof TimetableEvent>(
  events: readonly TimetableEvent[],
  index: number,
  field: K,
  val: TimetableEvent[K],
): TimetableEvent[] {
  return events.map((e, i) => (i === index ? { ...e, [field]: val } : e));
}

async function uploadImageToBucket(file: File): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: 'Musisz być zalogowany' };
  }
  if (!isAiMimeType(file.type)) {
    return { ok: false, error: 'Nieobsługiwany format pliku' };
  }
  const path = uploadPath(user.id, crypto.randomUUID(), file.type);
  const { error: uploadError } = await supabase.storage.from(AI_UPLOAD_BUCKET).upload(path, file);
  if (uploadError) {
    return { ok: false, error: 'Błąd podczas przesyłania pliku' };
  }
  return { ok: true, path };
}

async function fetchTimetableDraft(path: string): Promise<{ ok: true; draft: TimetableDraft } | { ok: false; error: string }> {
  const res = await fetch(TIMETABLE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, description: '' }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: err?.error ?? 'Nie udało się przeanalizować planu lekcji' };
  }
  const draft = (await res.json()) as TimetableDraft;
  return { ok: true, draft };
}

async function uploadAndFetchTimetable(file: File): Promise<{ ok: true; draft: TimetableDraft } | { ok: false; error: string }> {
  const uploadResult = await uploadImageToBucket(file);
  if (!uploadResult.ok) {
    return uploadResult;
  }
  return fetchTimetableDraft(uploadResult.path);
}

interface TimetableReviewStepProps {
  draft: TimetableDraft;
  onDraftChange: (draft: TimetableDraft) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function TimetableReviewStep({
  draft,
  onDraftChange,
  onConfirm,
  onCancel,
  isSubmitting,
}: TimetableReviewStepProps) {
  const handleAddEvent = () => {
    const newEvent: TimetableEvent = {
      title: 'Nowe zajęcia',
      weekday: DEFAULT_NEW_EVENT_WEEKDAY,
      startTime: DEFAULT_NEW_EVENT_START,
      endTime: DEFAULT_NEW_EVENT_END,
    };
    onDraftChange({ ...draft, events: [...draft.events, newEvent] });
  };

  return (
    <div className="space-y-4 py-2" data-slot="timetable-review-step">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <Label htmlFor="timetable-valid-from" className="text-xs">Obowiązuje od:</Label>
          <Input
            id="timetable-valid-from"
            type="date"
            value={draft.validFrom}
            onChange={(e) => onDraftChange({ ...draft, validFrom: e.target.value as LocalDate })}
            className="text-xs"
          />
        </div>
        <div>
          <Label htmlFor="timetable-valid-until" className="text-xs">Do:</Label>
          <Input
            id="timetable-valid-until"
            type="date"
            value={draft.validUntil}
            onChange={(e) => onDraftChange({ ...draft, validUntil: e.target.value as LocalDate })}
            className="text-xs"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Rozpoznane lekcje:</span>
          <Button type="button" variant="ghost" size="xs" onClick={handleAddEvent} className="text-xs text-primary">
            + Dodaj zajęcia
          </Button>
        </div>
        <ScrollArea className="max-h-52 pr-2">
          <div className="space-y-2">
            {draft.events.map((event, index) => (
              <TimetableEventRow
                key={index}
                event={event}
                canRemove={draft.events.length > 1}
                onTitleChange={(val) => onDraftChange({ ...draft, events: updateEventField(draft.events, index, 'title', val) })}
                onWeekdayChange={(val) => onDraftChange({ ...draft, events: updateEventField(draft.events, index, 'weekday', val) })}
                onStartTimeChange={(val) => onDraftChange({ ...draft, events: updateEventField(draft.events, index, 'startTime', val) })}
                onEndTimeChange={(val) => onDraftChange({ ...draft, events: updateEventField(draft.events, index, 'endTime', val) })}
                onRemove={() => onDraftChange({ ...draft, events: draft.events.filter((_, i) => i !== index) })}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting} type="button">Anuluj</Button>
        <Button onClick={onConfirm} disabled={isSubmitting || draft.events.length === 0} type="button">
          {isSubmitting ? 'Zapisywanie...' : 'Zapisz plan lekcji'}
        </Button>
      </div>
    </div>
  );
}

interface TimetableStepBodyProps {
  step: TimetableStep;
  draft: TimetableDraft | null;
  onConsentGiven: () => void;
  onFileSelect: (file: File) => void;
  onDraftChange: (draft: TimetableDraft) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function TimetableStepBody({
  step,
  draft,
  onConsentGiven,
  onFileSelect,
  onDraftChange,
  onConfirm,
  onCancel,
  isSubmitting,
}: TimetableStepBodyProps) {
  if (step === 'consent') {
    return <AiConsentStep onConsentGiven={onConsentGiven} onCancel={onCancel} />;
  }
  if (step === 'upload') {
    return <AiFileUploadStep accept={IMAGE_ACCEPT} onFileSelect={onFileSelect} onCancel={onCancel} />;
  }
  if (step === 'loading') {
    return <AiLoadingStep />;
  }
  return draft ? (
    <TimetableReviewStep
      draft={draft}
      onDraftChange={onDraftChange}
      onConfirm={onConfirm}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
    />
  ) : null;
}

export function TimetableImportDialog({
  open,
  onOpenChange,
  defaultTypeId,
  onImported,
}: TimetableImportDialogProps) {
  const [step, setStep] = React.useState<TimetableStep>('consent');
  const [draft, setDraft] = React.useState<TimetableDraft | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStep(hasAiConsent() ? 'upload' : 'consent');
      setDraft(null);
    }
  }

  const handleFileUpload = async (file: File) => {
    setStep('loading');
    const result = await uploadAndFetchTimetable(file);
    if (!result.ok) {
      toast.error(result.error);
      setStep('upload');
      return;
    }
    setDraft(result.draft);
    setStep('review');
  };

  const handleConfirm = async () => {
    if (!draft) {
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await confirmTimetable({
        typeId: defaultTypeId,
        validFrom: draft.validFrom,
        validUntil: draft.validUntil,
        events: draft.events,
      });
      if (res.ok) {
        toast.success(TIMETABLE_IMPORTED_SUCCESS_MESSAGE);
        onImported?.(res.data.count);
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error('Nie udało się zapisać planu lekcji');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wgraj plan lekcji (AI)</DialogTitle>
          <DialogDescription>{STEP_DESCRIPTIONS[step]}</DialogDescription>
        </DialogHeader>
        <TimetableStepBody
          step={step}
          draft={draft}
          onConsentGiven={() => setStep('upload')}
          onFileSelect={handleFileUpload}
          onDraftChange={setDraft}
          onConfirm={handleConfirm}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}
