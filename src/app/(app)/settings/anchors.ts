export type SettingsTab =
  | 'profile'
  | 'planning'
  | 'appearance'
  | 'notifications'
  | 'calendars'
  | 'account';

export const SETTINGS_TABS: readonly SettingsTab[] = [
  'profile',
  'planning',
  'appearance',
  'notifications',
  'calendars',
  'account',
] as const;

const TAB_SYNONYMS: Record<string, SettingsTab> = {
  profil: 'profile',
  profile: 'profile',
  planowanie: 'planning',
  planning: 'planning',
  wyglad: 'appearance',
  wygląd: 'appearance',
  appearance: 'appearance',
  powiadomienia: 'notifications',
  notifications: 'notifications',
  kalendarze: 'calendars',
  calendars: 'calendars',
  konto: 'account',
  account: 'account',
};

const CANONICAL_SLUGS: Record<SettingsTab, string> = {
  profile: 'profil',
  planning: 'planowanie',
  appearance: 'wyglad',
  notifications: 'powiadomienia',
  calendars: 'kalendarze',
  account: 'konto',
};

export function resolveTabFromHash(rawHash: unknown): SettingsTab {
  if (typeof rawHash !== 'string') {
    if (Array.isArray(rawHash) && rawHash.length > 0 && typeof rawHash[0] === 'string') {
      return resolveTabFromHash(rawHash[0]);
    }
    return 'profile';
  }

  let cleaned = rawHash.trim();
  if (!cleaned) {
    return 'profile';
  }

  if (cleaned.startsWith('#')) {
    cleaned = cleaned.slice(1);
  }

  let decoded = cleaned;
  try {
    decoded = decodeURIComponent(cleaned);
  } catch {
    decoded = cleaned;
  }

  const normalized = decoded.trim().toLowerCase();
  if (!normalized) {
    return 'profile';
  }

  return TAB_SYNONYMS[normalized] ?? 'profile';
}

export function getHashForTab(tab: SettingsTab): string {
  return CANONICAL_SLUGS[tab];
}
