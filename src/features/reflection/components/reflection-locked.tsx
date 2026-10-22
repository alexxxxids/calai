import Link from 'next/link';
import { LockIcon, SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface ReflectionLockedProps {
  readonly title?: string;
  readonly description: string;
}

export function ReflectionLocked({
  title = 'Moduł zablokowany',
  description,
}: ReflectionLockedProps) {
  return (
    <Card className="border-dashed border-2 bg-muted/30">
      <CardHeader className="text-center items-center pb-2">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
          <LockIcon className="size-6" aria-hidden="true" />
        </div>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        <CardDescription className="max-w-md mx-auto text-sm text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center pt-2">
        <Button asChild variant="outline" className="gap-2">
          <Link href="/settings">
            <SettingsIcon className="size-4" aria-hidden="true" />
            Przejdź do Ustawień
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
