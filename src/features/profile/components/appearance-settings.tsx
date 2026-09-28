'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { SunIcon, MoonIcon, LaptopIcon } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const THEME_OPTIONS = [
  {
    value: 'light',
    label: 'Jasny',
    description: 'Klasyczny jasny motyw o wysokim kontraście do pracy w dzień.',
    icon: SunIcon,
  },
  {
    value: 'dark',
    label: 'Ciemny',
    description: 'Ciemny motyw redukujący zmęczenie wzroku wieczorami i w nocy.',
    icon: MoonIcon,
  },
  {
    value: 'system',
    label: 'Systemowy',
    description: 'Automatyczne dopasowanie do ustawień Twojego urządzenia.',
    icon: LaptopIcon,
  },
] as const;

const emptySubscribe = () => () => {};

function useIsMounted(): boolean {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const isMounted = useIsMounted();

  if (!isMounted) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wygląd aplikacji</CardTitle>
        <CardDescription>
          Dostosuj motyw graficzny do swoich preferencji i pory dnia.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={theme ?? 'system'}
          onValueChange={setTheme}
          className="grid gap-3 sm:grid-cols-3"
        >
          {THEME_OPTIONS.map(({ value, label, description, icon: Icon }) => (
            <div
              key={value}
              className="flex items-start space-x-3 rounded-xl border border-border p-4 transition-colors hover:bg-accent/40"
            >
              <RadioGroupItem value={value} id={`theme-${value}`} className="mt-1" />
              <Label htmlFor={`theme-${value}`} className="cursor-pointer space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {description}
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
