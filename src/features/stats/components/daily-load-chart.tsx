'use client';

import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import type { DailyLoadItem } from '../types';

interface DailyLoadChartProps {
  readonly items: readonly DailyLoadItem[];
  readonly limit: number;
}

const BAR_CORNER_RADIUS = 4;
const DATE_SUBSTRING_START = 5;

const chartConfig = {
  points: {
    label: 'Punkty obciążenia',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

function formatDateLabel(dateStr: string): string {
  return dateStr.slice(DATE_SUBSTRING_START);
}

interface TooltipPayloadEntry {
  readonly value?: unknown;
  readonly payload?: {
    readonly date?: string;
    readonly points?: number;
    readonly limit?: number;
  };
}

interface CustomTooltipProps {
  readonly active?: boolean;
  readonly payload?: readonly TooltipPayloadEntry[];
  readonly label?: string | number;
}

function OverlimitMessage({ diff }: { readonly diff: number }) {
  if (diff <= 0) {
    return null;
  }
  return (
    <p className="mt-1 text-[11px] font-medium text-destructive">
      Przekroczono limit o {diff.toFixed(1)} pkt
    </p>
  );
}

function CustomDailyLoadTooltip({ active, payload }: CustomTooltipProps) {
  const dataPoint = payload?.[0]?.payload;
  if (!active || !dataPoint) {
    return null;
  }

  const { date = '', points = 0, limit = 0 } = dataPoint;
  const isOverLimit = points > limit;
  const overDiff = points - limit;

  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-foreground">{date}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Obciążenie:</span>
        <span
          className={`font-mono font-medium tabular-nums ${
            isOverLimit ? 'font-bold text-destructive' : 'text-foreground'
          }`}
        >
          {points} pkt
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Limit dzienny:</span>
        <span className="font-mono text-muted-foreground tabular-nums">{limit} pkt</span>
      </div>
      <OverlimitMessage diff={overDiff} />
    </div>
  );
}

export function DailyLoadChart({ items, limit }: DailyLoadChartProps) {
  const chartData = items.map((item) => ({
    ...item,
    formattedDate: formatDateLabel(item.date),
  }));

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Dzienny bilans obciążenia</CardTitle>
        <CardDescription>
          Punkty obciążenia w poszczególnych dniach względem limitu dziennego ({limit} pkt)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[260px] w-full"
          aria-label="Wykres obciążenia dziennego z linią limitu"
        >
          <BarChart
            data={chartData}
            margin={{ top: 16, right: 16, left: 0, bottom: 8 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="formattedDate"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip content={<CustomDailyLoadTooltip />} />
            <ReferenceLine
              y={limit}
              stroke="var(--destructive)"
              strokeDasharray="4 4"
              label={{
                value: `Limit (${limit})`,
                position: 'top',
                fill: 'var(--destructive)',
                fontSize: 11,
              }}
            />
            <Bar
              dataKey="points"
              fill="var(--color-points)"
              radius={[BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
