'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarIcon,
  TagsIcon,
  CheckSquareIcon,
  SparklesIcon,
  BarChart3Icon,
  SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  readonly label: string;
  readonly href: Route;
  readonly icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Kalendarz', href: '/calendar', icon: CalendarIcon },
  { label: 'Typy zadań', href: '/types', icon: TagsIcon },
  { label: 'Nawyki', href: '/habits', icon: CheckSquareIcon },
  { label: 'Refleksja', href: '/reflection', icon: SparklesIcon },
  { label: 'Statystyki', href: '/stats', icon: BarChart3Icon },
  { label: 'Ustawienia', href: '/settings', icon: SettingsIcon },
] as const;

interface AppNavProps {
  readonly onNavigate?: () => void;
  readonly className?: string;
}

export function AppNav({ onNavigate, className }: AppNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn('flex flex-col gap-1', className)} aria-label="Główna nawigacja">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary dark:bg-primary/20'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
