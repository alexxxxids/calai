'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  AI_ACCEPT,
  AI_MAX_FILE_BYTES,
  AI_MAX_FILE_MEGABYTES,
  AI_UPLOAD_BUCKET,
  isAiMimeType,
  uploadPath,
} from '@/features/ai/uploads';
import { createClient } from '@/lib/supabase/client';
import { formatFileSize } from './ai-dialog-rows';

export * from './ai-dialog-rows';

export const AI_CONSENT_KEY = 'calai_ai_consent';

const S_30 = 30, S_45 = 45, S_60 = 60, S_75 = 75, S_90 = 90, S_105 = 105;
const S_120 = 120, S_135 = 135, S_150 = 150, S_165 = 165, S_180 = 180;
export const SESSION_OPTIONS = [
  S_30, S_45, S_60, S_75, S_90, S_105, S_120, S_135, S_150, S_165, S_180,
] as const;

export const CONSENT_NOTE =
  'Materiały (pliki PDF, zdjęcia) są przesyłane do Google Gemini wyłącznie w celu ich analizy. Pliki są usuwane z serwera natychmiast po przetworzeniu.';
export const CONSENT_LABEL = 'Wyrażam zgodę na przesłanie materiałów do modelu AI (Google Gemini).';
export const AI_LOADING_TEXT = 'Trwa analiza materiałów przez AI...';
export const FILE_TOO_LARGE_ERROR = `Plik jest za duży. Maksymalny rozmiar to ${AI_MAX_FILE_MEGABYTES} MB.`;
export const FILE_INVALID_FORMAT_ERROR =
  'Nieobsługiwany format pliku. Dozwolone: PDF, JPG, PNG, WebP, HEIC.';

export function hasAiConsent(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(AI_CONSENT_KEY) === 'true';
}

export function setAiConsent(consent: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(AI_CONSENT_KEY, consent ? 'true' : 'false');
}

export async function uploadAiFileToStorage(
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
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

export interface AiConsentStepProps {
  onConsentGiven: () => void;
  onCancel?: () => void;
}

export function AiConsentStep({ onConsentGiven, onCancel }: AiConsentStepProps) {
  const [accepted, setAccepted] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      if (hasAiConsent()) {
        setAccepted(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    if (isMounted && accepted) {
      setAiConsent(true);
    }
    onConsentGiven();
  };

  return (
    <div className="space-y-4 py-2" data-slot="ai-consent-step">
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        {CONSENT_NOTE}
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="ai-consent-checkbox"
          checked={accepted}
          onCheckedChange={(val) => setAccepted(val === true)}
        />
        <Label htmlFor="ai-consent-checkbox" className="text-sm font-normal leading-relaxed cursor-pointer">
          {CONSENT_LABEL}
        </Label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <Button variant="outline" onClick={onCancel} type="button">Anuluj</Button>}
        <Button disabled={!accepted} onClick={handleContinue} type="button">Dalej</Button>
      </div>
    </div>
  );
}

export interface AiFileUploadStepProps {
  accept?: string;
  onFileSelect: (file: File) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export function AiFileUploadStep({
  accept = AI_ACCEPT,
  onFileSelect,
  onCancel,
  disabled = false,
}: AiFileUploadStepProps) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    if (!isAiMimeType(file.type)) {
      setErrorMessage(FILE_INVALID_FORMAT_ERROR);
      setSelectedFile(null);
      return;
    }
    if (file.size > AI_MAX_FILE_BYTES) {
      setErrorMessage(FILE_TOO_LARGE_ERROR);
      setSelectedFile(null);
      return;
    }
    setErrorMessage(null);
    setSelectedFile(file);
  };

  return (
    <div className="space-y-4 py-2" data-slot="ai-upload-step">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
        id="ai-file-input"
      />
      <div
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <span className="text-sm font-medium">Kliknij, aby wybrać plik</span>
        <span className="text-xs text-muted-foreground">PDF lub obraz do {AI_MAX_FILE_MEGABYTES} MB</span>
      </div>
      {selectedFile && (
        <div className="text-xs text-muted-foreground">
          Wybrany plik: <span className="font-medium text-foreground">{selectedFile.name}</span> ({formatFileSize(selectedFile.size)})
        </div>
      )}
      {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <Button variant="outline" onClick={onCancel} type="button">Anuluj</Button>}
        <Button disabled={!selectedFile || disabled} onClick={() => selectedFile && onFileSelect(selectedFile)} type="button">
          Analizuj materiał
        </Button>
      </div>
    </div>
  );
}

export function AiLoadingStep() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center" data-slot="ai-loading-step">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="text-sm font-medium">{AI_LOADING_TEXT}</p>
    </div>
  );
}
