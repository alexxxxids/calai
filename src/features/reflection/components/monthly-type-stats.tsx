import { formatMinutes } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DisplayTypeStat } from '../rules';

export interface MonthlyTypeStatsProps {
  readonly stats: readonly DisplayTypeStat[];
  readonly monthLabel: string;
}

export function MonthlyTypeStats({ stats, monthLabel }: MonthlyTypeStatsProps) {
  return (
    <Card className="bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Statystyka typów zadań ({monthLabel})
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Zestawienie planu i realizacji zadań według kategorii (FR-21, FR-101)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Brak zrealizowanych zadań w tym miesiącu.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {stats.map((stat) => (
              <div
                key={stat.typeId}
                className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 gap-2 text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="size-3.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stat.color }}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-foreground">
                    {stat.typeName}
                    {stat.isOneOff ? (
                      <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                        (jednorazowe)
                      </span>
                    ) : null}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">
                      {formatMinutes(stat.actualMinutes)}
                    </span>{' '}
                    / {formatMinutes(stat.plannedMinutes)}
                  </div>
                  <div className="text-xs">
                    ({stat.doneBlocks} ukończonych
                    {stat.missedBlocks > 0 ? `, ${stat.missedBlocks} pominiętych` : ''})
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
