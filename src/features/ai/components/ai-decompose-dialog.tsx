'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PRIORITY } from '@/domain/constants';
import { confirmDecomposition } from '@/features/ai/actions';
import {
  AiConsentStep,
  AiFileUploadStep,
  AiLoadingStep,
  hasAiConsent,
} from '@/features/ai/components/ai-dialog-helpers';
import {
  DecomposeReviewStep,
} from '@/features/ai/components/ai-dialog-review';
import type { DecompositionDraft } from '@/features/ai/schemas';
import {
  AI_UPLOAD_BUCKET,
  isAiMimeType,
  uploadPath,
} from '@/features/ai/uploads';
import { createClient } from '@/lib/supabase/client';

export {
  DEFAULT_NEW_TOPIC_MINUTES,
  SESSION_OPTIONS,
  DecomposeReviewStep,
  type DecomposeReviewStepProps,
} from '@/features/ai/components/ai-dialog-review';

export const TASK_CREATED_SUCCESS_MESSAGE = 'Zadanie utworzone pomyślnie';
const DECOMPOSE_API_URL = '/api/ai/decompose';

type DecomposeStep = 'consent' | 'upload' | 'loading' | 'review';

const STEP_DESCRIPTIONS: Record<DecomposeStep, string> = {
  consent: 'Zgoda na przetwarzanie materiałów przez model AI.',
  upload: 'Wybierz plik PDF lub zdjęcie materiałów.',
  loading: 'Trwa przetwarzanie przesłanych materiałów.',
  review: 'Sprawdź i dostosuj listę tematów przed utworzeniem zadania.',
};

export interface AiDecomposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typeId: string;
  deadline?: string | null;
  description?: string;
  onTaskCreated?: (taskId: string) => void;
}

async function uploadFileToBucket(file: File): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
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

async function fetchDecompositionDraft(
  payload: { path: string; typeId: string; deadline: string | null; description: string },
): Promise<{ ok: true; draft: DecompositionDraft } | { ok: false; error: string }> {
  const res = await fetch(DECOMPOSE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: err?.error ?? 'Nie udało się przeanalizować materiałów' };
  }
  const draft = (await res.json()) as DecompositionDraft;
  return { ok: true, draft };
}

async function uploadAndDecompose(
  file: File,
  typeId: string,
  deadline?: string | null,
  description?: string,
): Promise<{ ok: true; draft: DecompositionDraft } | { ok: false; error: string }> {
  const uploadResult = await uploadFileToBucket(file);
  if (!uploadResult.ok) {
    return uploadResult;
  }
  return fetchDecompositionDraft({
    path: uploadResult.path,
    typeId,
    deadline: deadline ?? null,
    description: description ?? '',
  });
}

interface DecomposeStepBodyProps {
  step: DecomposeStep;
  draft: DecompositionDraft | null;
  onConsentGiven: () => void;
  onFileSelect: (file: File) => void;
  onDraftChange: (draft: DecompositionDraft) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function DecomposeStepBody({
  step,
  draft,
  onConsentGiven,
  onFileSelect,
  onDraftChange,
  onConfirm,
  onCancel,
  isSubmitting,
}: DecomposeStepBodyProps) {
  if (step === 'consent') {
    return <AiConsentStep onConsentGiven={onConsentGiven} onCancel={onCancel} />;
  }
  if (step === 'upload') {
    return <AiFileUploadStep onFileSelect={onFileSelect} onCancel={onCancel} />;
  }
  if (step === 'loading') {
    return <AiLoadingStep />;
  }
  return draft ? (
    <DecomposeReviewStep
      draft={draft}
      onDraftChange={onDraftChange}
      onConfirm={onConfirm}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
    />
  ) : null;
}

export function AiDecomposeDialog({
  open,
  onOpenChange,
  typeId,
  deadline,
  description,
  onTaskCreated,
}: AiDecomposeDialogProps) {
  const [step, setStep] = React.useState<DecomposeStep>('consent');
  const [draft, setDraft] = React.useState<DecompositionDraft | null>(null);
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
    const result = await uploadAndDecompose(file, typeId, deadline, description);
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
      const res = await confirmDecomposition({
        typeId,
        priority: PRIORITY.normal,
        deadline,
        sessionMinutes: draft.sessionMinutes,
        topics: draft.topics,
      });
      if (res.ok) {
        toast.success(TASK_CREATED_SUCCESS_MESSAGE);
        onTaskCreated?.(res.data.taskId);
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error('Nie udało się utworzyć zadania');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rozbij materiał przez AI</DialogTitle>
          <DialogDescription>{STEP_DESCRIPTIONS[step]}</DialogDescription>
        </DialogHeader>
        <DecomposeStepBody
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
