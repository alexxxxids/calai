import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../actions', () => ({
  rotateFeedToken: vi.fn(),
  getFeedTokenAction: vi.fn().mockResolvedValue({ ok: true, data: { token: null, url: null } }),
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarFeedSettings } from './calendar-feed-settings';

describe('features/calendar-sync/components/calendar-feed-settings', () => {
  const sampleToken = 'e7f6d5c4b3a29180f1e2d3c4b5a69788e7f6d5c4b3a29180f1e2d3c4b5a69788';

  it('renders feed url, copy button and rotation button when token exists', () => {
    const html = renderToStaticMarkup(
      React.createElement(CalendarFeedSettings, { initialToken: sampleToken }),
    );

    expect(html).toContain('Eksport kalendarza (iCal)');
    expect(html).toContain('Twój prywatny adres subskrypcji');
    expect(html).toContain(`/api/ics/${sampleToken}`);
    expect(html).toContain('Kopiuj link');
    expect(html).toContain('Wygeneruj nowy link');
    expect(html).toContain('Jak dodać do Google Calendar?');
  });

  it('renders creation prompt when initialToken is null', () => {
    const html = renderToStaticMarkup(
      React.createElement(CalendarFeedSettings, { initialToken: null }),
    );

    expect(html).toContain('Eksport kalendarza (iCal)');
    expect(html).toContain('Nie posiadasz jeszcze wygenerowanego linku do subskrypcji');
    expect(html).toContain('Wygeneruj link do kalendarza');
    expect(html).not.toContain('Kopiuj link');
    expect(html).not.toContain('Wygeneruj nowy link');
  });

  it('renders loading state when initialToken is undefined and awaiting action', () => {
    const html = renderToStaticMarkup(
      React.createElement(CalendarFeedSettings, {}),
    );

    expect(html).toContain('Sprawdzanie stanu linku kalendarza...');
  });
});
