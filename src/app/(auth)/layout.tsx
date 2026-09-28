import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/app/logo';
import { ThemeToggle } from '@/components/app/theme-toggle';

/** Login, sign-up and password pages: one card in the middle of the screen. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="flex h-14 items-center justify-between px-4">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <footer className="px-4 py-6 text-center text-sm text-muted-foreground">
        <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
          Polityka prywatności
        </Link>
      </footer>
    </div>
  );
}
