'use client';

import * as React from 'react';
import { MenuIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Logo } from '@/components/app/logo';
import { AppNav } from '@/components/app/app-nav';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { AccountMenu } from '@/features/auth/components/account-menu';

interface MobileNavProps {
  readonly userEmail: string | null;
}

export function MobileNav({ userEmail }: MobileNavProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="flex md:hidden items-center justify-between border-b border-border bg-card px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Otwórz menu nawigacji">
              <MenuIcon className="size-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col justify-between w-72 p-6">
            <div className="space-y-6">
              <SheetHeader className="text-left">
                <SheetTitle className="sr-only">Nawigacja główna</SheetTitle>
                <Logo href="/calendar" />
              </SheetHeader>
              <AppNav onNavigate={() => setOpen(false)} />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-4">
              <ThemeToggle />
              <AccountMenu email={userEmail} />
            </div>
          </SheetContent>
        </Sheet>
        <Logo href="/calendar" />
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <AccountMenu email={userEmail} />
      </div>
    </header>
  );
}
