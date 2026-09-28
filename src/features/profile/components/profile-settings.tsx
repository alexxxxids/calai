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
import { DisplayNameField } from './display-name-field';
import { TimezoneField } from './timezone-field';
import { DayWindowFields } from './day-window-fields';
import { updateProfile } from '../actions';
import { COMMON_TIMEZONES } from '../schemas';

interface ProfileSettingsProps {
  readonly initialData: {
    readonly displayName: string;
    readonly timezone: string;
    readonly dayStart: string;
    readonly dayEnd: string;
  };
}

export function ProfileSettings({ initialData }: ProfileSettingsProps) {
  const [displayName, setDisplayName] = React.useState(initialData.displayName);
  const [timezone, setTimezone] = React.useState(initialData.timezone);
  const [dayStart, setDayStart] = React.useState(initialData.dayStart);
  const [dayEnd, setDayEnd] = React.useState(initialData.dayEnd);
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  const timezoneOptions = React.useMemo(() => {
    const supported = typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : COMMON_TIMEZONES;
    return Array.from(new Set([...COMMON_TIMEZONES, ...supported])).sort();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const res = await updateProfile({ displayName, timezone, dayStart, dayEnd });
      if (res.ok) {
        toast.success('Profil został zaktualizowany');
      } else {
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          toast.error('Sprawdź błędy w formularzu');
        } else {
          toast.error(res.error);
        }
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
          <CardTitle>Profil użytkownika</CardTitle>
          <CardDescription>
            Zarządzaj swoim imieniem, strefą czasową oraz domyślnym oknem pracy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <DisplayNameField
            value={displayName}
            onChange={setDisplayName}
            error={errors.displayName?.[0]}
          />
          <TimezoneField
            value={timezone}
            options={timezoneOptions}
            onChange={setTimezone}
            error={errors.timezone?.[0]}
          />
          <DayWindowFields
            dayStart={dayStart}
            dayEnd={dayEnd}
            onDayStartChange={setDayStart}
            onDayEndChange={setDayEnd}
            startError={errors.dayStart?.[0]}
            endError={errors.dayEnd?.[0]}
          />
        </CardContent>
        <CardFooter className="border-t border-border pt-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Zapisywanie...' : 'Zapisz profil'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
