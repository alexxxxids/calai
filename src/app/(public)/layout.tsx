import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/app/logo';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { Button } from '@/components/ui/button';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Logo />
          <nav aria-label="Konto" className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost">
              <Link href="/login">Zaloguj się</Link>
            </Button>
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/register">Załóż konto</Link>
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>CalAI — szkolny projekt z informatyki. Tylko dla osób pełnoletnich.</p>
          <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
            Polityka prywatności
          </Link>
        </div>
      </footer>
    </div>
  );
}
