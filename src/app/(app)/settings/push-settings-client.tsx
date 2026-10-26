'use client';

import dynamic from 'next/dynamic';
import { BellIcon, Loader2Icon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function PushSettingsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellIcon className="size-5" aria-hidden="true" />
          Powiadomienia Push
        </CardTitle>
        <CardDescription>
          Ładowanie preferencji powiadomień...
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          Sprawdzanie stanu powiadomień...
        </div>
      </CardContent>
    </Card>
  );
}

export const DynamicPushSettings = dynamic(
  () => import('@/features/notifications/components/push-settings').then((mod) => mod.PushSettings),
  {
    ssr: false,
    loading: () => <PushSettingsSkeleton />,
  },
);
