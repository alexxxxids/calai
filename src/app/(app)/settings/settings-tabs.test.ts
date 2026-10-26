import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsTabs, TAB_ITEMS } from './settings-tabs';
import { getHashForTab, resolveTabFromHash, type SettingsTab } from './anchors';
import * as TabsUI from '@/components/ui/tabs';

const EXPECTED_TABS_COUNT = 6;

describe('SettingsTabs TAB_ITEMS specification', () => {
  it('defines exactly 6 settings tabs in canonical order', () => {
    expect(TAB_ITEMS).toHaveLength(EXPECTED_TABS_COUNT);
    expect(TAB_ITEMS.map((item) => item.value)).toEqual([
      'profile',
      'planning',
      'appearance',
      'notifications',
      'calendars',
      'account',
    ]);
    expect(TAB_ITEMS.map((item) => item.label)).toEqual([
      'Profil',
      'Planowanie',
      'Wygląd',
      'Powiadomienia',
      'Kalendarze',
      'Konto',
    ]);
  });
});

describe('SettingsTabs markup rendering', () => {
  it('renders all 6 tabs with proper ids, labels, and children', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        SettingsTabs,
        { initialTab: 'profile' },
        React.createElement('div', { id: 'settings-child' }, 'Zawartość zakładek'),
      ),
    );

    expect(html).toContain('Profil');
    expect(html).toContain('Planowanie');
    expect(html).toContain('Wygląd');
    expect(html).toContain('Powiadomienia');
    expect(html).toContain('Kalendarze');
    expect(html).toContain('Konto');

    expect(html).toContain('id="tab-profile"');
    expect(html).toContain('aria-controls="panel-profile"');
    expect(html).toContain('id="tab-planning"');
    expect(html).toContain('aria-controls="panel-planning"');
    expect(html).toContain('id="tab-appearance"');
    expect(html).toContain('aria-controls="panel-appearance"');
    expect(html).toContain('id="tab-notifications"');
    expect(html).toContain('aria-controls="panel-notifications"');
    expect(html).toContain('id="tab-calendars"');
    expect(html).toContain('aria-controls="panel-calendars"');
    expect(html).toContain('id="tab-account"');
    expect(html).toContain('aria-controls="panel-account"');

    expect(html).toContain('id="settings-child"');
    expect(html).toContain('Zawartość zakładek');
    expect(html).toContain('space-y-6');
    expect(html).toContain('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6');
  });
});

describe('SettingsTabs active tab state', () => {
  it('defaults active tab to profile when initialTab is omitted', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        SettingsTabs,
        null,
        React.createElement('span', null, 'child'),
      ),
    );

    expect(html).toMatch(
      /aria-selected="true"[^>]*id="tab-profile"|id="tab-profile"[^>]*aria-selected="true"/,
    );
    expect(html).toMatch(
      /data-state="active"[^>]*id="tab-profile"|id="tab-profile"[^>]*data-state="active"/,
    );
    expect(html).toMatch(
      /aria-selected="false"[^>]*id="tab-calendars"|id="tab-calendars"[^>]*aria-selected="false"/,
    );
    expect(html).toMatch(
      /data-state="inactive"[^>]*id="tab-calendars"|id="tab-calendars"[^>]*data-state="inactive"/,
    );
  });

  it.each<SettingsTab>([
    'profile',
    'planning',
    'appearance',
    'notifications',
    'calendars',
    'account',
  ])('activates %s tab when initialTab is provided', (tab) => {
    const html = renderToStaticMarkup(
      React.createElement(
        SettingsTabs,
        { initialTab: tab },
        React.createElement('span', null, 'content'),
      ),
    );

    const activeRegex = new RegExp(
      `(aria-selected="true"[^>]*id="tab-${tab}"|id="tab-${tab}"[^>]*aria-selected="true")`,
    );
    const stateRegex = new RegExp(
      `(data-state="active"[^>]*id="tab-${tab}"|id="tab-${tab}"[^>]*data-state="active")`,
    );
    expect(html).toMatch(activeRegex);
    expect(html).toMatch(stateRegex);
  });
});

describe('SettingsTabs replaceState tab changes', () => {
  let originalWindow: typeof globalThis.window;
  let replaceStateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalWindow = globalThis.window;
    replaceStateMock = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      // @ts-expect-error cleanup window stub
      delete globalThis.window;
    }
  });

  it('calls history.replaceState with canonical polish hash when tab changes', () => {
    const mockWindow = {
      location: { hash: '' },
      history: { replaceState: replaceStateMock },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    // @ts-expect-error mock window
    globalThis.window = mockWindow;

    let capturedOnValueChange: ((value: string) => void) | undefined;
    const OriginalTabs = TabsUI.Tabs;
    vi.spyOn(TabsUI, 'Tabs').mockImplementation((props: React.ComponentProps<typeof TabsUI.Tabs>) => {
      capturedOnValueChange = props.onValueChange;
      return React.createElement(OriginalTabs, props);
    });

    renderToStaticMarkup(
      React.createElement(
        SettingsTabs,
        { initialTab: 'profile' },
        React.createElement('div', null, 'tab body'),
      ),
    );

    expect(capturedOnValueChange).toBeDefined();

    for (const item of TAB_ITEMS) {
      capturedOnValueChange?.(item.value);
      const expectedSlug = getHashForTab(item.value);
      expect(replaceStateMock).toHaveBeenCalledWith(null, '', `#${expectedSlug}`);
    }
  });

  it('gracefully handles missing window during tab change without crashing', () => {
    // @ts-expect-error simulate SSR node environment
    delete globalThis.window;

    let capturedOnValueChange: ((value: string) => void) | undefined;
    const OriginalTabs = TabsUI.Tabs;
    vi.spyOn(TabsUI, 'Tabs').mockImplementation((props: React.ComponentProps<typeof TabsUI.Tabs>) => {
      capturedOnValueChange = props.onValueChange;
      return React.createElement(OriginalTabs, props);
    });

    renderToStaticMarkup(
      React.createElement(
        SettingsTabs,
        { initialTab: 'profile' },
        React.createElement('div', null, 'tab body'),
      ),
    );

    expect(() => {
      capturedOnValueChange?.('calendars');
    }).not.toThrow();
  });
});

describe('SettingsTabs replaceState slug synonyms', () => {
  let originalWindow: typeof globalThis.window;
  let replaceStateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalWindow = globalThis.window;
    replaceStateMock = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      // @ts-expect-error cleanup window stub
      delete globalThis.window;
    }
  });

  it('resolves polish synonym slugs and raw hash strings correctly when changing tabs', () => {
    const mockWindow = {
      location: { hash: '' },
      history: { replaceState: replaceStateMock },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    // @ts-expect-error mock window
    globalThis.window = mockWindow;

    let capturedOnValueChange: ((value: string) => void) | undefined;
    const OriginalTabs = TabsUI.Tabs;
    vi.spyOn(TabsUI, 'Tabs').mockImplementation((props: React.ComponentProps<typeof TabsUI.Tabs>) => {
      capturedOnValueChange = props.onValueChange;
      return React.createElement(OriginalTabs, props);
    });

    renderToStaticMarkup(
      React.createElement(
        SettingsTabs,
        { initialTab: 'profile' },
        React.createElement('div', null, 'tab body'),
      ),
    );

    capturedOnValueChange?.('planowanie');
    expect(replaceStateMock).toHaveBeenCalledWith(null, '', '#planowanie');

    capturedOnValueChange?.('#wyglad');
    expect(replaceStateMock).toHaveBeenCalledWith(null, '', '#wyglad');

    capturedOnValueChange?.('powiadomienia');
    expect(replaceStateMock).toHaveBeenCalledWith(null, '', '#powiadomienia');

    capturedOnValueChange?.('kalendarze');
    expect(replaceStateMock).toHaveBeenCalledWith(null, '', '#kalendarze');

    capturedOnValueChange?.('konto');
    expect(replaceStateMock).toHaveBeenCalledWith(null, '', '#konto');

    capturedOnValueChange?.('unknown-hash');
    expect(replaceStateMock).toHaveBeenCalledWith(null, '', '#profil');
  });
});

describe('SettingsTabs hash resolution contract', () => {
  it.each<[string, SettingsTab]>([
    ['#profil', 'profile'],
    ['#planowanie', 'planning'],
    ['#wyglad', 'appearance'],
    ['#wygląd', 'appearance'],
    ['#powiadomienia', 'notifications'],
    ['#kalendarze', 'calendars'],
    ['#konto', 'account'],
    ['profil', 'profile'],
    ['planowanie', 'planning'],
    ['wyglad', 'appearance'],
    ['powiadomienia', 'notifications'],
    ['kalendarze', 'calendars'],
    ['konto', 'account'],
    ['', 'profile'],
    ['#unknown', 'profile'],
  ])('maps hash %s to tab %s', (hash, expectedTab) => {
    expect(resolveTabFromHash(hash)).toBe(expectedTab);
  });
});
