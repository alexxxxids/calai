'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { MAX_RATING_SCORE, MIN_RATING_SCORE } from '../schemas';

export interface RatingRadioGroupProps {
  readonly label: string;
  readonly description?: string;
  readonly name: string;
  readonly value: number;
  readonly minLabel: string;
  readonly maxLabel: string;
  readonly onChange: (value: number) => void;
  readonly disabled?: boolean;
}

const RATING_OPTIONS = Array.from(
  { length: MAX_RATING_SCORE - MIN_RATING_SCORE + 1 },
  (_, i) => MIN_RATING_SCORE + i,
);

function getNextScore(current: number, key: string): number | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return current < MAX_RATING_SCORE ? current + 1 : MIN_RATING_SCORE;
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return current > MIN_RATING_SCORE ? current - 1 : MAX_RATING_SCORE;
  }
  if (key === 'Home') {
    return MIN_RATING_SCORE;
  }
  if (key === 'End') {
    return MAX_RATING_SCORE;
  }
  return null;
}

export function RatingRadioGroup({
  label,
  description,
  name,
  value,
  minLabel,
  maxLabel,
  onChange,
  disabled = false,
}: RatingRadioGroupProps) {
  const groupId = useId();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const next = getNextScore(value, e.key);
    if (next !== null) {
      e.preventDefault();
      onChange(next);
      const targetBtn = document.getElementById(`${groupId}-opt-${next}`);
      targetBtn?.focus();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-0.5">
        <Label id={`${groupId}-label`} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        {description ? (
          <p id={`${groupId}-desc`} className="text-xs text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        aria-describedby={description ? `${groupId}-desc` : undefined}
        className="flex flex-col gap-1.5"
      >
        <div className="grid grid-cols-5 gap-2">
          {RATING_OPTIONS.map((score) => {
            const isSelected = value === score;
            return (
              <button
                key={score}
                id={`${groupId}-opt-${score}`}
                type="button"
                role="radio"
                name={name}
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                disabled={disabled}
                onClick={() => onChange(score)}
                onKeyDown={handleKeyDown}
                className={cn(
                  'flex h-11 items-center justify-center rounded-lg border text-sm font-semibold transition-all',
                  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {score}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
          <span>
            {MIN_RATING_SCORE}: {minLabel}
          </span>
          <span>
            {MAX_RATING_SCORE}: {maxLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
