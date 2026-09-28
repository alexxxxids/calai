'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  MIN_DAILY_ENERGY_LIMIT,
  MAX_DAILY_ENERGY_LIMIT,
} from '@/features/profile/schemas';

interface EnergyLimitFieldsProps {
  readonly value: number;
  readonly onChange: (val: number) => void;
  readonly error?: string;
}

export function EnergyLimitFields({
  value,
  onChange,
  error,
}: EnergyLimitFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="energyLimit" className="text-foreground font-medium">
          Dzienny limit obciążenia
        </Label>
        <span className="text-sm font-bold text-primary">{value} pkt</span>
      </div>
      <Slider
        id="energyLimit"
        min={MIN_DAILY_ENERGY_LIMIT}
        max={MAX_DAILY_ENERGY_LIMIT}
        step={1}
        value={[value]}
        onValueChange={(vals) => {
          if (vals[0] !== undefined) {
            onChange(vals[0]);
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        Punkty obciążenia odzwierciedlają wysiłek mentalny: regeneracja 0 pkt,
        lekkie 1 pkt, średnie 2 pkt, ciężkie 3 pkt na godzinę. Domyślny limit to 20 punktów.
      </p>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
