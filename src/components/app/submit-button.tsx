import { Loader2Icon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, 'type'> & {
  /** True while the form's action runs: the button is locked, so one click sends once. */
  pending: boolean;
};

export function SubmitButton({ pending, children, disabled, ...props }: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending && <Loader2Icon className="animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}
