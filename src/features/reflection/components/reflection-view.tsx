'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon, CalendarRangeIcon } from 'lucide-react';
import type { ReflectionState } from '../types';
import { WeeklyReflectionForm } from './weekly-reflection-form';
import { MonthlyReflectionForm } from './monthly-reflection-form';
import { ReflectionLocked } from './reflection-locked';

export interface ReflectionViewProps {
  readonly state: ReflectionState;
  readonly defaultTab?: 'weekly' | 'monthly';
}

export function ReflectionView({
  state,
  defaultTab = 'weekly',
}: ReflectionViewProps) {
  const { weekly, monthly } = state;

  return (
    <Tabs defaultValue={defaultTab} className="w-full space-y-6">
      <div className="flex justify-center sm:justify-start">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="weekly" className="gap-2">
            <CalendarIcon className="size-4" aria-hidden="true" />
            Tydzień
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <CalendarRangeIcon className="size-4" aria-hidden="true" />
            Miesiąc
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="weekly" className="space-y-4 focus-visible:outline-hidden">
        {weekly ? (
          <WeeklyReflectionForm state={weekly} />
        ) : (
          <ReflectionLocked
            title="Refleksja tygodniowa jest zablokowana"
            description="Twój obecny poziom to podstawowy. Aby odblokować cotygodniową ankietę samopoczucia i kalibrację limitu, przejdź na poziom analityczny w Ustawieniach."
          />
        )}
      </TabsContent>

      <TabsContent value="monthly" className="space-y-4 focus-visible:outline-hidden">
        {monthly ? (
          <MonthlyReflectionForm state={monthly} />
        ) : (
          <ReflectionLocked
            title="Podsumowanie miesięczne jest zablokowane"
            description="Podsumowanie strategiczne oraz analiza kategorii zadań są dostępne na poziomie strategicznym. Możesz zmienić poziom w Ustawieniach."
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
