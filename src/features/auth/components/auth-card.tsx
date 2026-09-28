import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';

/** The frame shared by every login and sign-up page: heading, one form, links below it. */
export function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && <CardFooter className="flex-col items-start gap-2">{footer}</CardFooter>}
    </Card>
  );
}

/** The class for plain text links on these pages, so they all look the same. */
export const AUTH_LINK_CLASS = 'font-medium underline underline-offset-4 hover:text-primary';
