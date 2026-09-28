'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EnergyLimitFields } from './energy-limit-fields';
import { ReflectionLevelFields } from './reflection-level-fields';
import { updateProfile } from '../actions';

interface PlanningSettingsProps {
  readonly initialData: {
    readonly dailyEnergyLimit: number;
    readonly reflectionLevel: 'basic' | 'analytic' | 'strategic';
  };
}

export function PlanningSettings({ initialData }: PlanningSettingsProps) {
  const [dailyEnergyLimit, setDailyEnergyLimit] = React.useState(
    initialData.dailyEnergyLimit,
  );
  const [reflectionLevel, setReflectionLevel] = React.useState(
    initialData.reflectionLevel,
  );
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await updateProfile({ dailyEnergyLimit, reflectionLevel });
      if (res.ok) {
        toast.success('Ustawienia planowania zostały zaktualizowane');
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Planowanie i obciążenie</CardTitle>
          <CardDescription>
            Skonfiguruj dzienny limit energii oraz poziom analityki i retrospektyw.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <EnergyLimitFields
            value={dailyEnergyLimit}
            onChange={setDailyEnergyLimit}
          />
          <ReflectionLevelFields
            value={reflectionLevel}
            onChange={setReflectionLevel}
          />
        </CardContent>
        <CardFooter className="border-t border-border pt-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Zapisywanie...' : 'Zapisz planowanie'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
