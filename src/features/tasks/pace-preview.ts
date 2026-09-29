import { snapNearInteger } from '@/domain/math';
import { normalizeSessionMinutes } from '@/domain/scheduler/session';
import { formatMinutes } from '@/lib/format';

const DEFAULT_PACE = 1.0;
const MIN_EFFECTIVE_MINUTES = 1;

export interface PacePreview {
  readonly estimatedMinutes: number;
  readonly effectiveDurationMinutes: number;
  readonly formattedText: string;
}

export function calculatePacePreview(estimateMinutes: number, pace: number): PacePreview {
  if (!Number.isFinite(estimateMinutes) || estimateMinutes <= 0) {
    throw new RangeError(`Expected positive estimateMinutes, got ${estimateMinutes}`);
  }
  const safePace = Number.isFinite(pace) && pace > 0 ? pace : DEFAULT_PACE;
  const estimated = Math.round(estimateMinutes);
  const effective = Math.max(MIN_EFFECTIVE_MINUTES, Math.round(snapNearInteger(estimated * safePace)));
  const formattedText = `Twoja ocena: ${formatMinutes(estimated)} → z Twoim tempem: ${formatMinutes(effective)}`;

  return {
    estimatedMinutes: estimated,
    effectiveDurationMinutes: effective,
    formattedText,
  };
}

export function formatPacePreview(estimateMinutes: number, pace: number): string {
  return calculatePacePreview(estimateMinutes, pace).formattedText;
}

export function normalizeTaskSession(sessionMinutes: number | null | undefined): number | null {
  if (sessionMinutes === null || sessionMinutes === undefined) {
    return null;
  }
  return normalizeSessionMinutes(sessionMinutes);
}
