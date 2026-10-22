'use client';

import Link from 'next/link';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import type { FatigueTrendItem } from '../types';

interface FatigueTrendChartProps {
  readonly items: readonly FatigueTrendItem[];
  readonly reflectionLevel: 'basic' | 'analytic' | 'strategic';
}

const chartConfig = {
  fatigue: {
    label: 'Zmęczenie',
    color: 'var(--chart-1)',
  },
  stress: {
    label: 'Stres',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

const MIN_RATING = 1;
const MAX_RATING = 5;
const RATING_SCORE_ONE = 1;
const RATING_SCORE_TWO = 2;
const RATING_SCORE_THREE = 3;
const RATING_SCORE_FOUR = 4;
const RATING_SCORE_FIVE = 5;
const RATING_TICKS = [
  RATING_SCORE_ONE,
  RATING_SCORE_TWO,
  RATING_SCORE_THREE,
  RATING_SCORE_FOUR,
  RATING_SCORE_FIVE,
];
const DATE_SUBSTRING_START = 5;

function formatWeekLabel(weekStart: string): string {
  return weekStart.slice(DATE_SUBSTRING_START);
}

interface TooltipPayloadEntry {
  readonly value?: unknown;
  readonly dataKey?: string | number;
  readonly color?: string;
}

interface CustomTooltipProps {
  readonly active?: boolean;
  readonly payload?: readonly TooltipPayloadEntry[];
  readonly label?: string | number;
}

function CustomFatigueTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const rawLabel = String(label ?? '');
  const displayLabel = rawLabel.length >= DATE_SUBSTRING_START ? formatWeekLabel(rawLabel) : rawLabel;

  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-foreground">Tydzień: {displayLabel}</p>
      {payload.map((entry, index) => {
        const val = typeof entry.value === 'number' ? entry.value : 0;
        const name = entry.dataKey === 'fatigue' ? 'Zmęczenie' : 'Stres';
        const color = entry.color ?? (entry.dataKey === 'fatigue' ? 'var(--chart-1)' : 'var(--chart-2)');

        return (
          <div key={index} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted-foreground">{name}:</span>
            </div>
            <span className="font-mono font-bold text-foreground">{val} / 5</span>
          </div>
        );
      })}
    </div>
  );
}

function BasicLevelBanner() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 p-6 text-center text-muted-foreground">
      <p className="text-sm font-medium text-foreground">
        Trendy samopoczucia wymagają cotygodniowej refleksji
      </p>
      <p className="mt-1 text-xs">
        Jesteś obecnie na poziomie podstawowym. Włącz poziom analityczny lub strategiczny w{' '}
        <Link href="/settings" className="font-medium text-primary underline underline-offset-4">
          Ustawieniach
        </Link>
        , aby śledzić poziom zmęczenia i stresu.
      </p>
    </div>
  );
}

function EmptyTrendNotice() {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center text-center text-muted-foreground">
      <span className="text-3xl font-light text-muted-foreground/60">—</span>
      <p className="mt-2 text-xs">Brak wypełnionych ankiet refleksji w ostatnich tygodniach.</p>
    </div>
  );
}

function FatigueTrendLineChart({
  items,
}: {
  readonly items: readonly FatigueTrendItem[];
}) {
  return (
    <ChartContainer
      role="img"
      config={chartConfig}
      className="aspect-auto h-[240px] w-full"
      aria-label="Wykres liniowy zmęczenia i stresu w kolejnych tygodniach"
    >
      <LineChart
        data={[...items]}
        margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="weekStart"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={formatWeekLabel}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          domain={[MIN_RATING, MAX_RATING]}
          ticks={RATING_TICKS}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip content={<CustomFatigueTooltip />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="fatigue"
          stroke="var(--color-fatigue)"
          strokeWidth={2.5}
          dot={{ r: 4, fill: 'var(--color-fatigue)' }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="stress"
          stroke="var(--color-stress)"
          strokeWidth={2.5}
          dot={{ r: 4, fill: 'var(--color-stress)' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

export function FatigueTrendChart({ items, reflectionLevel }: FatigueTrendChartProps) {
  const isBasicLevel = reflectionLevel === 'basic';
  const hasData = items.length > 0;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Trendy samopoczucia (zmęczenie i stres)</CardTitle>
        <CardDescription>
          Średnia ocena zmęczenia i poziomu stresu z cotygodniowych refleksji (skala 1–5)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {isBasicLevel ? (
          <BasicLevelBanner />
        ) : !hasData ? (
          <EmptyTrendNotice />
        ) : (
          <FatigueTrendLineChart items={items} />
        )}
      </CardContent>
    </Card>
  );
}
