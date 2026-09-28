import { CircleAlertIcon } from 'lucide-react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import type { FormState } from '@/lib/action-result';

/** The form-level error of the last submit; nothing before the first submit or after success. */
export function FormAlert({ state }: { state: FormState<unknown> }) {
  if (state === null || state.ok) {
    return null;
  }
  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden="true" />
      <AlertTitle>{state.error}</AlertTitle>
    </Alert>
  );
}
