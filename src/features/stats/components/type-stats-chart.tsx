'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatMinutes } from '@/lib/format';
import { MINUTES_PER_HOUR, type TypeStatItem } from '../types';

interface TypeStatsChartProps {
  readonly items: readonly TypeStatItem[];
}

const BAR_CORNER_RADIUS = 4;
const MAX_TICK_LABEL_LENGTH = 14;
const TICK_LABEL_TRUNCATE_END = 13;

const chartConfig = {
  plannedMinutes: {
    label: 'Plan',
    color: 'var(--chart-1)',
  },
  actualMinutes: {
    label: 'Wykonanie',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

function formatAxisMinutes(minutes: number): string {
  if (minutes === 0) {
    return '0';
  }
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes} min`;
  }
  const hours = minutes / MINUTES_PER_HOUR;
  return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;
}

function formatTypeNameTick(name: string): string {
  if (name.length > MAX_TICK_LABEL_LENGTH) {
    return `${name.slice(0, TICK_LABEL_TRUNCATE_END)}…`;
  }
  return name;
}

interface TooltipPayloadEntry {
  readonly name?: string | number;
  readonly value?: unknown;
  readonly color?: string;
  readonly dataKey?: string | number;
}

interface CustomTooltipProps {
  readonly active?: boolean;
  readonly payload?: readonly TooltipPayloadEntry[];
  readonly label?: string | number;
}

function CustomTypeStatsTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-foreground">{String(label)}</p>
      {payload.map((entry, index) => {
        const rawVal = typeof entry.value === 'number' ? entry.value : 0;
        const val = rawVal >= 0 ? rawVal : 0;
        const formatted = formatMinutes(val);
        const name = entry.dataKey === 'plannedMinutes' ? 'Plan' : 'Wykonanie';
        const color = entry.color ?? (entry.dataKey === 'plannedMinutes' ? 'var(--chart-1)' : 'var(--chart-2)');

        return (
          <div key={index} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-xs"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted-foreground">{name}:</span>
            </div>
            <span className="font-mono font-medium text-foreground">{formatted}</span>
          </div>
        );
      })}
    </div>
  );
}

export function TypeStatsChart({ items }: TypeStatsChartProps) {
  const hasData =
    items.length > 0 &&
    items.some((item) => item.plannedMinutes > 0 || item.actualMinutes > 0);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Rozkład czasu według typów zadań</CardTitle>
        <CardDescription>
          Porównanie zaplanowanego i rzeczywistego czasu (dla zamkniętych bloków)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {hasData ? (
          <ChartContainer
            role="img"
            config={chartConfig}
            className="aspect-auto h-[280px] w-full"
            aria-label="Wykres słupkowy czasu planowanego i zrealizowanego według typów zadań"
          >
            <BarChart
              data={[...items]}
              margin={{ top: 12, right: 12, left: 0, bottom: 24 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="typeName"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                tickFormatter={formatTypeNameTick}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatAxisMinutes}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip content={<CustomTypeStatsTooltip />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="plannedMinutes"
                fill="var(--color-plannedMinutes)"
                radius={[BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0, 0]}
              />
              <Bar
                dataKey="actualMinutes"
                fill="var(--color-actualMinutes)"
                radius={[BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[280px] flex-col items-center justify-center text-center text-muted-foreground">
            <span className="text-3xl font-light text-muted-foreground/60">—</span>
            <p className="mt-2 text-xs">Brak zaplanowanych lub zrealizowanych zadań w wybranym okresie.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
