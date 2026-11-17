'use client';

import type { ReactNode } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/app/logo';
import { ThemeToggle } from '@/components/app/theme-toggle';

interface AppShellProps {
  readonly onResetDemo?: () => void;
  readonly children: ReactNode;
}

export function AppShell({ onResetDemo, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo href="/" />
            <span className="hidden sm:inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Kalendarz · localStorage
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onResetDemo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={onResetDemo}
              >
                <RotateCcwIcon className="size-3.5" aria-hidden="true" />
                <span>Resetuj demo</span>
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
