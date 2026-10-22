'use client';

import { CircleUserIcon, LogOutIcon, SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/features/auth/actions';
import { forgetThisBrowserPush } from '@/features/notifications/client';

/** The account button in the app header: who is signed in, settings, sign-out. */
export function AccountMenu({ email }: { email: string | null }) {
  const [isSigningOut, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await forgetThisBrowserPush();
      const result = await signOut();
      // Reached only when signing out failed: on success the action redirects to /login.
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Konto">
          <CircleUserIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate">{email ?? 'Twoje konto'}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon aria-hidden="true" />
            Ustawienia
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleSignOut} disabled={isSigningOut}>
          <LogOutIcon aria-hidden="true" />
          Wyloguj
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
