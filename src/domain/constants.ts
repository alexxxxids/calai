/**
 * Every number the domain logic depends on, each with the reason for its value.
 * docs/algorithms.md is the source of truth: change a number there and here in the same PR.
 * Durations are in minutes unless the name says otherwise.
 */

// ── Units ──────────────────────────────────────────────────────────────────────

/** Instants are milliseconds since the epoch, durations are minutes: this converts between them. */
export const MS_PER_MINUTE = 60_000;
/** Energy points are counted per hour of activity (docs/algorithms.md §5.1). */
export const MINUTES_PER_HOUR = 60;
/** A wall-clock time 'HH:mm' has hours 00–23. */
export const HOURS_PER_DAY = 24;
/** 24 real hours. A calendar day in a time zone can have 23 or 25 hours, so never step dates with this. */
export const MS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * MS_PER_MINUTE;
/**
 * Floating-point results carry crumbs around 1e-13 (60 / 1.3333333333333335 = 44.99999999999999).
 * A real fraction of a minute is far bigger than 1e-9, so anything closer to a whole number is a crumb.
 */
export const FLOAT_NOISE = 1e-9;

// ── Pace (docs/algorithms.md §4) ───────────────────────────────────────────────

/** A sample below 0.25 ("done in a quarter of the time") is almost surely a typo, not a pace. */
export const PACE_SAMPLE_MIN = 0.25;
/** One forgotten, never-closed block ("counted 6 hours") must not wreck the calibration. */
export const PACE_SAMPLE_MAX = 4.0;
/** Pace below 0.5 would plan less than half the estimate: fix the estimate instead. */
export const PACE_MIN = 0.5;
/** Pace above 2.0 would plan more than double the estimate: fix the estimate instead. */
export const PACE_MAX = 2.0;
/** A type without history starts at "exactly as estimated". */
export const TYPE_PACE_SEED = 1.0;
/** A type has a long history, so one new sample moves its pace gently. */
export const TYPE_PACE_ALPHA = 0.2;
/** 0.8^30 ≈ 0.001: samples older than the last 30 would move the type pace by less than 0.1 %. */
export const TYPE_PACE_MAX_SAMPLES = 30;
/** A task has few samples, and each one says a lot about the rest of this very task. */
export const TASK_PACE_ALPHA = 0.5;

// ── Load and stress (docs/algorithms.md §5) ────────────────────────────────────

/** Scores are 1–5 and more focus is better, so 6 − focus turns it into "more is worse" like the rest. */
export const FOCUS_INVERSION_BASE = 6;
/** The overload index is the mean of four weekly scores. */
export const OVERLOAD_SCORE_COUNT = 4;
/** Overload thresholds and limit multipliers, checked from the worst: a tired week plans less. */
export const OVERLOAD_STEPS = [
  { minOverload: 4.5, multiplier: 0.6 },
  { minOverload: 4.0, multiplier: 0.75 },
  { minOverload: 3.5, multiplier: 0.9 },
] as const;
/** No sign of stress: the daily limit stays as the user set it. */
export const NO_STRESS_MULTIPLIER = 1.0;
/** Fewer closed blocks in 7 days say too little about the user to lower the limit (FR-62). */
export const FALLBACK_MIN_CLOSED_BLOCKS = 5;
/** Finishing less than half of the planned blocks is a sign of overload. */
export const FALLBACK_MIN_COMPLETION = 0.5;
/** Needing on average more than 1.5× the estimate is a sign of overload. */
export const FALLBACK_MAX_MEAN_PACE = 1.5;
/** Daily metrics are a weaker signal than a weekly reflection, so they lower the limit only a little. */
export const FALLBACK_STRESS_MULTIPLIER = 0.85;

// ── Planner (docs/algorithms.md §6.1) ──────────────────────────────────────────

/** Task priority levels with the numbers stored in tasks.priority: the smaller, the more important. */
export const PRIORITY = { high: 1, normal: 2, low: 3 } as const;

/** Grid step: blocks start and end at :00, :15, :30, :45, which is easy to read in a calendar. */
export const SLOT = 15;
/** The next 15 minutes are never planned: the user needs time to see the new plan. */
export const START_BUFFER = 15;
/** A session shorter than 30 minutes is not worth sitting down for. */
export const MIN_SESSION = 30;
/** Three hours is the most one sitting can hold; tasks.session_minutes and the AI use 30–180 too. */
export const MAX_SESSION = 180;
/** Block length when a task has no session_minutes: about two school lessons of focused work. */
export const DEFAULT_SESSION = 90;
/** Work is spread over days: spaced repetition beats cramming. */
export const MAX_SESSIONS_PER_TASK_PER_DAY = 2;
/** From this energy level on, work is demanding and needs breaks (Szkoła = 2, Nauka = 3). */
export const HEAVY_ENERGY = 2;
/** Demanding work is never planned for longer than two hours without a break. */
export const MAX_CONTINUOUS_HEAVY = 120;
/** A pause of at least 20 minutes is a real break; a shorter one does not end a demanding stretch. */
export const BREAK_AFTER_HEAVY = 20;
/** Length of the recovery block reserved every day in stress mode (FR-63). */
export const RECOVERY_MINUTES = 60;
/** Energy of a recovery block: rest restores, it does not tire. */
export const RECOVERY_ENERGY = 0;
/** Default horizon: two weeks is enough to spread work and still close enough to be realistic. */
export const HORIZON_DAYS = 14;
/** Hard cap on the horizon: a plan more than two months ahead is a guess, whatever the deadline. */
export const MAX_HORIZON_DAYS = 60;
