'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { CompletionRateSummary } from '../types';

interface CompletionRateCardProps {
  readonly summary: CompletionRateSummary;
}

export function CompletionRateCard({ summary }: CompletionRateCardProps) {
  const hasData = summary.percentage !== null;

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <CardTitle>Wskaźnik realizacji zadań</CardTitle>
        <CardDescription>
          Stosunek zrealizowanych bloków zadań do wszystkich zamkniętych
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasData ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-4xl font-bold tracking-tight text-foreground tabular-nums">
                {summary.percentage}%
              </span>
              <span className="text-xs text-muted-foreground">
                {summary.totalDone} z {summary.totalClosed} bloków
              </span>
            </div>

            <Progress
              value={summary.percentage ?? 0}
              aria-label={`Wskaźnik ukończenia zadań: ${summary.percentage}%`}
              className="h-2.5"
            />

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="rounded-md border border-border/50 bg-muted/30 p-2">
                <span className="text-muted-foreground">Zrealizowane:</span>
                <p className="font-semibold text-foreground tabular-nums">{summary.totalDone}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-muted/30 p-2">
                <span className="text-muted-foreground">Pominięte:</span>
                <p className="font-semibold text-foreground tabular-nums">{summary.totalMissed}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
            <span className="text-3xl font-light text-muted-foreground/60">—</span>
            <p className="mt-2 text-xs">Brak zamkniętych zadań w wybranym okresie.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
