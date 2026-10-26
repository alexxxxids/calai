import { describe, expect, it } from 'vitest';
import {
  SETTINGS_TABS,
  getHashForTab,
  resolveTabFromHash,
} from './anchors';

describe('SETTINGS_TABS', () => {
  it('contains exactly the 6 defined tabs in order', () => {
    expect(SETTINGS_TABS).toEqual([
      'profile',
      'planning',
      'appearance',
      'notifications',
      'calendars',
      'account',
    ]);
  });
});

describe('resolveTabFromHash', () => {
  it('returns profile for null, undefined, empty, or whitespace inputs', () => {
    expect(resolveTabFromHash(null)).toBe('profile');
    expect(resolveTabFromHash(undefined)).toBe('profile');
    expect(resolveTabFromHash('')).toBe('profile');
    expect(resolveTabFromHash('   ')).toBe('profile');
    expect(resolveTabFromHash('#')).toBe('profile');
    expect(resolveTabFromHash('#   ')).toBe('profile');
  });

  it('resolves all Polish canonical slugs (with and without hash)', () => {
    expect(resolveTabFromHash('#profil')).toBe('profile');
    expect(resolveTabFromHash('profil')).toBe('profile');

    expect(resolveTabFromHash('#planowanie')).toBe('planning');
    expect(resolveTabFromHash('planowanie')).toBe('planning');

    expect(resolveTabFromHash('#wyglad')).toBe('appearance');
    expect(resolveTabFromHash('wyglad')).toBe('appearance');

    expect(resolveTabFromHash('#wygląd')).toBe('appearance');
    expect(resolveTabFromHash('wygląd')).toBe('appearance');

    expect(resolveTabFromHash('#powiadomienia')).toBe('notifications');
    expect(resolveTabFromHash('powiadomienia')).toBe('notifications');

    expect(resolveTabFromHash('#kalendarze')).toBe('calendars');
    expect(resolveTabFromHash('kalendarze')).toBe('calendars');

    expect(resolveTabFromHash('#konto')).toBe('account');
    expect(resolveTabFromHash('konto')).toBe('account');
  });

  it('resolves English synonyms (with and without hash)', () => {
    expect(resolveTabFromHash('#profile')).toBe('profile');
    expect(resolveTabFromHash('profile')).toBe('profile');

    expect(resolveTabFromHash('#planning')).toBe('planning');
    expect(resolveTabFromHash('planning')).toBe('planning');

    expect(resolveTabFromHash('#appearance')).toBe('appearance');
    expect(resolveTabFromHash('appearance')).toBe('appearance');

    expect(resolveTabFromHash('#notifications')).toBe('notifications');
    expect(resolveTabFromHash('notifications')).toBe('notifications');

    expect(resolveTabFromHash('#calendars')).toBe('calendars');
    expect(resolveTabFromHash('calendars')).toBe('calendars');

    expect(resolveTabFromHash('#account')).toBe('account');
    expect(resolveTabFromHash('account')).toBe('account');
  });

  it('handles percent-encoded Polish characters correctly', () => {
    expect(resolveTabFromHash('#wygl%C4%85d')).toBe('appearance');
    expect(resolveTabFromHash('wygl%C4%85d')).toBe('appearance');
  });

  it('handles malformed URI sequences without throwing and falls back to profile', () => {
    expect(resolveTabFromHash('#%E0%A4%A')).toBe('profile');
    expect(resolveTabFromHash('%E0%A4%A')).toBe('profile');
  });

  it('handles uppercase and surrounding whitespace', () => {
    expect(resolveTabFromHash('#KONTO')).toBe('account');
    expect(resolveTabFromHash('  #PLANNING  ')).toBe('planning');
    expect(resolveTabFromHash('  #wygląd  ')).toBe('appearance');
    expect(resolveTabFromHash('  #POWIADOMIENIA  ')).toBe('notifications');
    expect(resolveTabFromHash('  CALENDARS  ')).toBe('calendars');
  });

  it('handles array inputs safely (e.g. repeated searchParams)', () => {
    expect(resolveTabFromHash(['konto', 'profil'])).toBe('account');
    expect(resolveTabFromHash(['#kalendarze'])).toBe('calendars');
    expect(resolveTabFromHash([])).toBe('profile');
    expect(resolveTabFromHash([123])).toBe('profile');
  });

  it('handles non-string unknown inputs safely without throwing', () => {
    expect(resolveTabFromHash(123)).toBe('profile');
    expect(resolveTabFromHash(true)).toBe('profile');
    expect(resolveTabFromHash({})).toBe('profile');
  });

  it('falls back to profile for unknown hashes', () => {
    expect(resolveTabFromHash('#unknown')).toBe('profile');
    expect(resolveTabFromHash('#random-tab')).toBe('profile');
    expect(resolveTabFromHash('something-else')).toBe('profile');
  });
});

describe('getHashForTab', () => {
  it('returns canonical Polish slugs without leading hash for all tabs', () => {
    expect(getHashForTab('profile')).toBe('profil');
    expect(getHashForTab('planning')).toBe('planowanie');
    expect(getHashForTab('appearance')).toBe('wyglad');
    expect(getHashForTab('notifications')).toBe('powiadomienia');
    expect(getHashForTab('calendars')).toBe('kalendarze');
    expect(getHashForTab('account')).toBe('konto');
  });

  it('ensures returned slugs do not start with #', () => {
    for (const tab of SETTINGS_TABS) {
      const slug = getHashForTab(tab);
      expect(slug.startsWith('#')).toBe(false);
    }
  });

  it('roundtrips every canonical slug back to the same tab through resolveTabFromHash', () => {
    for (const tab of SETTINGS_TABS) {
      const slug = getHashForTab(tab);
      expect(resolveTabFromHash(slug)).toBe(tab);
      expect(resolveTabFromHash(`#${slug}`)).toBe(tab);
    }
  });
});
