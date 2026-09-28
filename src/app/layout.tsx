import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Geist } from 'next/font/google';
import { ThemeProvider } from '@/components/app/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// latin-ext carries the Polish letters (ą, ę, ł, ś…); without it they fall back to another font.
const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: { default: 'CalAI', template: '%s · CalAI' },
  description: 'Inteligentny planer czasu: sam układa zadania w wolnych okienkach kalendarza.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // next-themes sets the `dark` class on <html> before React loads, so the server HTML and the
    // browser disagree about this one attribute on purpose; suppressHydrationWarning is for that only.
    <html lang="pl" className={cn('font-sans', geist.variable)} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
