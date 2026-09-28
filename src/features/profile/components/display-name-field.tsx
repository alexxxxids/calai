'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MAX_DISPLAY_NAME_LENGTH } from '@/features/profile/schemas';

interface DisplayNameFieldProps {
  readonly value: string;
  readonly onChange: (val: string) => void;
  readonly error?: string;
}

export function DisplayNameField({
  value,
  onChange,
  error,
}: DisplayNameFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="displayName" className="text-foreground font-medium">
        Twoje imię lub pseudonim
      </Label>
      <Input
        id="displayName"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="np. Jan"
        required
        maxLength={MAX_DISPLAY_NAME_LENGTH}
        autoComplete="name"
      />
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
