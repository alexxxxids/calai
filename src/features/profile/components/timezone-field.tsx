'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TimezoneFieldProps {
  readonly value: string;
  readonly options: readonly string[];
  readonly onChange: (val: string) => void;
  readonly error?: string;
}

export function TimezoneField({
  value,
  options,
  onChange,
  error,
}: TimezoneFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="timezone" className="text-foreground font-medium">
        Strefa czasowa
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="timezone" className="w-full">
          <SelectValue placeholder="Wybierz strefę czasową" />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-60">
          {options.map((tz) => (
            <SelectItem key={tz} value={tz}>
              {tz}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
