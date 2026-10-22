import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../actions', () => ({
  addSubscription: vi.fn(),
  removeSubscription: vi.fn(),
  syncSubscriptionAction: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CalendarSubscriptionWithDetails } from '../queries';
import { CalendarSubscriptionsSettings } from './calendar-subscriptions-settings';

describe('features/calendar-sync/components/calendar-subscriptions-settings', () => {
  const sampleTaskTypes = [
    { id: 'type-1', name: 'Nauka', color: '#3b82f6' },
    { id: 'type-2', name: 'Praca', color: '#10b981' },
  ];

  const sampleSubscriptions: CalendarSubscriptionWithDetails[] = [
    {
      id: 'sub-1',
      name: 'Plan zajęć USOS',
      url: 'https://usos.example.com/ical/feed.ics',
      typeId: 'type-1',
      typeName: 'Nauka',
      typeColor: '#3b82f6',
      lastSyncedAt: '2026-10-22T10:30:00.000Z',
      lastError: null,
      createdAt: '2026-10-20T12:00:00.000Z',
    },
    {
      id: 'sub-2',
      name: 'Kalendarz firmowy',
      url: 'https://work.example.com/calendar.ics',
      typeId: 'type-2',
      typeName: 'Praca',
      typeColor: '#10b981',
      lastSyncedAt: '2026-10-22T11:00:00.000Z',
      lastError: 'Przekroczono limit czasu połączenia (10 s)',
      createdAt: '2026-10-21T08:00:00.000Z',
    },
  ];

  it('renders empty state when no subscriptions exist', () => {
    const html = renderToStaticMarkup(
      React.createElement(CalendarSubscriptionsSettings, {
        initialSubscriptions: [],
        taskTypes: sampleTaskTypes,
      }),
    );

    expect(html).toContain('Subskrypcje kalendarza (import iCal)');
    expect(html).toContain('Nie masz jeszcze żadnych subskrypcji kalendarza');
    expect(html).toContain('Dodaj kalendarz');
  });

  it('renders list of subscriptions with type badges and action buttons', () => {
    const html = renderToStaticMarkup(
      React.createElement(CalendarSubscriptionsSettings, {
        initialSubscriptions: sampleSubscriptions,
        taskTypes: sampleTaskTypes,
      }),
    );

    expect(html).toContain('Plan zajęć USOS');
    expect(html).toContain('https://usos.example.com/ical/feed.ics');
    expect(html).toContain('Nauka');
    expect(html).toContain('Synchronizuj');
    expect(html).toContain('Usuń');
    expect(html).not.toContain('Nie masz jeszcze żadnych subskrypcji kalendarza');
  });

  it('renders error badge when last_error is present', () => {
    const html = renderToStaticMarkup(
      React.createElement(CalendarSubscriptionsSettings, {
        initialSubscriptions: sampleSubscriptions,
        taskTypes: sampleTaskTypes,
      }),
    );

    expect(html).toContain('Kalendarz firmowy');
    expect(html).toContain('Przekroczono limit czasu połączenia (10 s)');
  });
});
