'use client';

import type { ReactNode } from 'react';
import { Logo } from '@/components/app/logo';
import { AppNav } from '@/components/app/app-nav';
import { MobileNav } from '@/components/app/mobile-nav';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { AccountMenu } from '@/features/auth/components/account-menu';
import { TimezoneBanner } from '@/features/profile/components/timezone-banner';

interface AppShellProps {
  readonly userEmail: string | null;
  readonly profileTimezone: string;
  readonly children: ReactNode;
}

export function AppShell({
  userEmail,
  profileTimezone,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <MobileNav userEmail={userEmail} />

      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col border-r border-border bg-card">
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-border">
          <Logo href="/calendar" />
        </div>
        <div className="flex flex-1 flex-col justify-between overflow-y-auto p-4">
          <AppNav />
          <div className="flex items-center justify-between border-t border-border pt-4 px-2">
            <ThemeToggle />
            <AccountMenu email={userEmail} />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="md:pl-64 flex flex-col flex-1">
        <TimezoneBanner profileTimezone={profileTimezone} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
