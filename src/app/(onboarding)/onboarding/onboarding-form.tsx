'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { OnboardingInput } from '@/features/profile/schemas';
import { completeOnboarding } from '@/features/profile/actions';
import { DisplayNameField } from '@/features/profile/components/display-name-field';
import { TimezoneField } from '@/features/profile/components/timezone-field';
import { DayWindowFields } from '@/features/profile/components/day-window-fields';
import { ReflectionLevelFields } from '@/features/profile/components/reflection-level-fields';
import { EnergyLimitFields } from '@/features/profile/components/energy-limit-fields';

interface OnboardingFormProps {
  readonly initialValues: OnboardingInput;
}

const COMMON_TIMEZONES = [
  'Europe/Warsaw',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Kyiv',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'UTC',
] as const;

function resolveInitialTimezone(fallback: string): string {
  if (typeof window !== 'undefined') {
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTz && browserTz !== 'Factory') {
        return browserTz;
      }
    } catch {
      // ignore
    }
  }
  return fallback;
}

export function OnboardingForm({ initialValues }: OnboardingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const [displayName, setDisplayName] = React.useState(initialValues.displayName);
  const [timezone, setTimezone] = React.useState(() =>
    resolveInitialTimezone(initialValues.timezone)
  );
  const [dayStart, setDayStart] = React.useState(initialValues.dayStart);
  const [dayEnd, setDayEnd] = React.useState(initialValues.dayEnd);
  const [reflectionLevel, setReflectionLevel] = React.useState(initialValues.reflectionLevel);
  const [dailyEnergyLimit, setDailyEnergyLimit] = React.useState(initialValues.dailyEnergyLimit);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  const timezoneOptions = React.useMemo(() => {
    const supported = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : COMMON_TIMEZONES;
    return Array.from(new Set([...COMMON_TIMEZONES, ...supported])).sort();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const payload: OnboardingInput = {
        displayName,
        timezone,
        dayStart,
        dayEnd,
        reflectionLevel,
        dailyEnergyLimit,
      };
      const result = await completeOnboarding(payload);
      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success('Konfiguracja ukończona! Witaj w CalAI.');
      router.push('/calendar');
      router.refresh();
    });
  };

  return (
    <Card className="shadow-lg border-border">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
          Skonfiguruj swój profil
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          CalAI dopasuje planowanie zadań do Twoich nawyków i godzin pracy.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <DisplayNameField value={displayName} onChange={setDisplayName} error={errors.displayName?.[0]} />
          <TimezoneField value={timezone} options={timezoneOptions} onChange={setTimezone} error={errors.timezone?.[0]} />
          <DayWindowFields
            dayStart={dayStart}
            dayEnd={dayEnd}
            onDayStartChange={setDayStart}
            onDayEndChange={setDayEnd}
            startError={errors.dayStart?.[0]}
            endError={errors.dayEnd?.[0]}
          />
          <ReflectionLevelFields value={reflectionLevel} onChange={setReflectionLevel} />
          <EnergyLimitFields value={dailyEnergyLimit} onChange={setDailyEnergyLimit} error={errors.dailyEnergyLimit?.[0]} />
        </CardContent>
        <CardFooter className="pt-2">
          <Button type="submit" className="w-full text-base font-medium py-6" disabled={isPending}>
            {isPending ? 'Zapisywanie...' : 'Rozpocznij korzystanie z CalAI'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
