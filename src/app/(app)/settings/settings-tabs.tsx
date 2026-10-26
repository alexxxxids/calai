'use client';

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type SettingsTab,
  getHashForTab,
  resolveTabFromHash,
} from './anchors';

export interface SettingsTabsProps {
  readonly initialTab?: SettingsTab;
  readonly children?: React.ReactNode;
}

export const TAB_ITEMS: ReadonlyArray<{ readonly value: SettingsTab; readonly label: string }> = [
  { value: 'profile', label: 'Profil' },
  { value: 'planning', label: 'Planowanie' },
  { value: 'appearance', label: 'Wygląd' },
  { value: 'notifications', label: 'Powiadomienia' },
  { value: 'calendars', label: 'Kalendarze' },
  { value: 'account', label: 'Konto' },
];

export function SettingsTabs({ initialTab, children }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>(() => initialTab ?? 'profile');

  React.useEffect(() => {
    const handleHashChange = () => {
      if (typeof window === 'undefined') {
        return;
      }
      const currentHash = window.location.hash;
      if (currentHash) {
        setActiveTab(resolveTabFromHash(currentHash));
      } else {
        setActiveTab(initialTab ?? 'profile');
      }
    };

    if (typeof window !== 'undefined' && window.location.hash) {
      handleHashChange();
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [initialTab]);

  const handleTabChange = (nextValue: string) => {
    const nextTab = resolveTabFromHash(nextValue);
    setActiveTab(nextTab);
    if (typeof window !== 'undefined') {
      const slug = getHashForTab(nextTab);
      window.history.replaceState(null, '', `#${slug}`);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
      <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto group-data-horizontal/tabs:h-auto gap-1.5 p-1.5 w-full max-w-4xl">
        {TAB_ITEMS.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            id={`tab-${item.value}`}
            aria-controls={`panel-${item.value}`}
            className="h-9 py-2 px-3 text-xs sm:text-sm font-medium"
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
