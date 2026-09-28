import { useId, type ComponentProps, type ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type TextFieldProps = Omit<ComponentProps<typeof Input>, 'id' | 'name'> & {
  name: string;
  label: string;
  description?: ReactNode;
  /** Message from the server for this field (see fieldError()). */
  error?: string;
};

/**
 * Label + input + hint + error, wired together for screen readers: the label names
 * the input, and the hint and the error are read out as its description.
 */
export function TextField({ name, label, description, error, ...inputProps }: TextFieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = [description ? descriptionId : null, error ? errorId : null]
    .filter((part) => part !== null)
    .join(' ');

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {description && <FieldDescription id={descriptionId}>{description}</FieldDescription>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}
