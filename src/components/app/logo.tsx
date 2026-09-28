import { CalendarCheckIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/** The app name with its icon, as a link: to the landing page for guests, to the calendar inside the app. */
export function Logo({ href = '/', className }: { href?: Route; className?: string }) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center gap-2 text-lg font-semibold tracking-tight', className)}
    >
      <CalendarCheckIcon className="size-5 text-primary" aria-hidden="true" />
      CalAI
    </Link>
  );
}
