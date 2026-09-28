'use client';

import { MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ThemeName = 'light' | 'dark' | 'system';

/** The three choices of spec FR-44, in the order they are shown. */
export const THEME_OPTIONS = [
  { value: 'light', label: 'Jasny', icon: SunIcon },
  { value: 'dark', label: 'Ciemny', icon: MoonIcon },
  { value: 'system', label: 'Systemowy', icon: MonitorIcon },
] as const satisfies readonly { value: ThemeName; label: string; icon: LucideIcon }[];

/**
 * The theme switch in the header. The button shows a sun or a moon through the `dark:` classes,
 * that is with CSS only: the server does not know the theme, and CSS needs no JavaScript to be right.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Zmień motyw">
          <SunIcon className="dark:hidden" aria-hidden="true" />
          <MoonIcon className="hidden dark:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Motyw</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden="true" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
