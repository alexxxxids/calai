'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  STATS_RANGE_7_DAYS,
  STATS_RANGE_30_DAYS,
  STATS_RANGE_90_DAYS,
  type StatsRange,
} from '../types';

interface PeriodSelectorProps {
  readonly currentRange: StatsRange;
}

const PERIOD_OPTIONS: readonly { readonly label: string; readonly value: StatsRange }[] = [
  { label: '7 dni', value: STATS_RANGE_7_DAYS },
  { label: '30 dni', value: STATS_RANGE_30_DAYS },
  { label: '90 dni', value: STATS_RANGE_90_DAYS },
];

export function PeriodSelector({ currentRange }: PeriodSelectorProps) {
  return (
    <nav
      role="group"
      aria-label="Wybierz okres statystyk"
      className="inline-flex rounded-lg border border-border bg-muted/40 p-1"
    >
      {PERIOD_OPTIONS.map((option) => {
        const isSelected = option.value === currentRange;
        return (
          <Button
            key={option.value}
            asChild
            variant={isSelected ? 'default' : 'ghost'}
            size="sm"
            className="text-xs"
            aria-current={isSelected ? 'page' : undefined}
          >
            <Link href={`/stats?range=${option.value}`} replace>
              {option.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
