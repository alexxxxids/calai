/**
 * Polish texts for numbers, moments and our small enumerations.
 * Moments are always shown in an explicit time zone (the user's profile.timezone),
 * never in the zone of the machine: the server runs in UTC (docs/coding-standards.md §6).
 */

const MINUTES_PER_HOUR = 60;
const LOCALE = 'pl-PL';

/** 90 → '1 h 30 min', 60 → '1 h', 45 → '45 min'. Fractions of a minute are rounded. */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError(`Expected a non-negative number of minutes, got ${minutes}`);
  }
  const total = Math.round(minutes);
  const hours = Math.floor(total / MINUTES_PER_HOUR);
  const rest = total % MINUTES_PER_HOUR;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** '5 października 2026' */
export function formatDate(instant: Date | number, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instant);
}

/** '08:00' */
export function formatTime(instant: Date | number, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(instant);
}

/** '5 października 2026 08:00' */
export function formatDateTime(instant: Date | number, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(instant);
}

// ── Energy of a task type (spec §3; the database keeps it within 0–3) ──────────────

export const ENERGY_LEVELS = [0, 1, 2, 3] as const;
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];

export const ENERGY_LABEL = {
  0: 'regeneracja',
  1: 'lekkie',
  2: 'średnie',
  3: 'ciężkie',
} as const satisfies Record<EnergyLevel, string>;

/** A database number → its Polish name; the number itself if it is not a known level. */
export function formatEnergy(energy: number): string {
  const level = ENERGY_LEVELS.find((candidate) => candidate === energy);
  return level === undefined ? String(energy) : ENERGY_LABEL[level];
}

// ── Days of the week, ISO numbering: 1 = Monday … 7 = Sunday ──────────────────────

export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type IsoWeekday = (typeof ISO_WEEKDAYS)[number];

export const WEEKDAY_SHORT = {
  1: 'pn',
  2: 'wt',
  3: 'śr',
  4: 'cz',
  5: 'pt',
  6: 'sb',
  7: 'nd',
} as const satisfies Record<IsoWeekday, string>;

export const WEEKDAY_NAME = {
  1: 'poniedziałek',
  2: 'wtorek',
  3: 'środa',
  4: 'czwartek',
  5: 'piątek',
  6: 'sobota',
  7: 'niedziela',
} as const satisfies Record<IsoWeekday, string>;

/** [1, 3, 5] → 'pn, śr, pt'; all seven days → 'codziennie'. Order follows the week. */
export function formatWeekdays(weekdays: readonly number[]): string {
  const days = ISO_WEEKDAYS.filter((day) => weekdays.includes(day));
  if (days.length === ISO_WEEKDAYS.length) {
    return 'codziennie';
  }
  return days.map((day) => WEEKDAY_SHORT[day]).join(', ');
}
