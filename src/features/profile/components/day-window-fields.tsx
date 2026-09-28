'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface DayWindowFieldsProps {
  readonly dayStart: string;
  readonly dayEnd: string;
  readonly onDayStartChange: (val: string) => void;
  readonly onDayEndChange: (val: string) => void;
  readonly startError?: string;
  readonly endError?: string;
}

export function DayWindowFields({
  dayStart,
  dayEnd,
  onDayStartChange,
  onDayEndChange,
  startError,
  endError,
}: DayWindowFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="dayStart" className="text-foreground font-medium">
          Początek okna dnia
        </Label>
        <Input
          id="dayStart"
          type="time"
          value={dayStart}
          onChange={(e) => onDayStartChange(e.target.value)}
          required
        />
        {startError && (
          <p className="text-sm font-medium text-destructive">{startError}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="dayEnd" className="text-foreground font-medium">
          Koniec okna dnia
        </Label>
        <Input
          id="dayEnd"
          type="time"
          value={dayEnd}
          onChange={(e) => onDayEndChange(e.target.value)}
          required
        />
        {endError && (
          <p className="text-sm font-medium text-destructive">{endError}</p>
        )}
      </div>
    </div>
  );
}
