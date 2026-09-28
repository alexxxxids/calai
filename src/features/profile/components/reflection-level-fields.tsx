'use client';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ReflectionLevelFieldsProps {
  readonly value: 'basic' | 'analytic' | 'strategic';
  readonly onChange: (val: 'basic' | 'analytic' | 'strategic') => void;
}

export function ReflectionLevelFields({
  value,
  onChange,
}: ReflectionLevelFieldsProps) {
  return (
    <div className="space-y-3">
      <Label className="text-foreground font-medium">
        Poziom refleksji (FR-11)
      </Label>
      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as 'basic' | 'analytic' | 'strategic')}
        className="grid gap-3"
      >
        <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent/40 transition-colors">
          <RadioGroupItem value="basic" id="ref-basic" className="mt-1" />
          <Label htmlFor="ref-basic" className="cursor-pointer space-y-1">
            <div className="font-semibold text-foreground">Podstawowy</div>
            <div className="text-xs text-muted-foreground">
              Codzienne planowanie i zamykanie dnia z podsumowaniem zadań.
            </div>
          </Label>
        </div>

        <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent/40 transition-colors">
          <RadioGroupItem value="analytic" id="ref-analytic" className="mt-1" />
          <Label htmlFor="ref-analytic" className="cursor-pointer space-y-1">
            <div className="font-semibold text-foreground">Analityczny</div>
            <div className="text-xs text-muted-foreground">
              Dodaje tygodniową refleksję, automatyczną kalibrację tempa i wykresy.
            </div>
          </Label>
        </div>

        <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent/40 transition-colors">
          <RadioGroupItem value="strategic" id="ref-strategic" className="mt-1" />
          <Label htmlFor="ref-strategic" className="cursor-pointer space-y-1">
            <div className="font-semibold text-foreground">Strategiczny</div>
            <div className="text-xs text-muted-foreground">
              Pełna analityka: miesięczna retrospektywa i cele długoterminowe.
            </div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
