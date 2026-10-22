'use client';

import type { StatsOverview } from '../types';
import { CompletionRateCard } from './completion-rate-card';
import { DailyLoadChart } from './daily-load-chart';
import { FatigueTrendChart } from './fatigue-trend-chart';
import { PeriodSelector } from './period-selector';
import { TypeStatsChart } from './type-stats-chart';

interface StatsViewProps {
  readonly initialData: StatsOverview;
}

export function StatsView({ initialData }: StatsViewProps) {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Statystyki
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Przegląd realizacji zadań, obciążenia i trendów samopoczucia
          </p>
        </div>
        <PeriodSelector currentRange={initialData.range} />
      </header>

      <section
        aria-label="Podsumowanie realizacji i czasu"
        className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        <div className="lg:col-span-1">
          <CompletionRateCard summary={initialData.completionRate} />
        </div>
        <div className="lg:col-span-2">
          <TypeStatsChart items={initialData.typeStats} />
        </div>
      </section>

      <section aria-label="Wykres obciążenia">
        <DailyLoadChart
          items={initialData.dailyLoad}
          limit={initialData.effectiveLimit}
        />
      </section>

      <section aria-label="Wykres samopoczucia">
        <FatigueTrendChart
          items={initialData.fatigueTrend}
          reflectionLevel={initialData.reflectionLevel}
        />
      </section>
    </div>
  );
}
