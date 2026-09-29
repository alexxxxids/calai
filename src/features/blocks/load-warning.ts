import { energyPoints } from '@/domain/energy';
import type { WarningLoadResult } from './types';

/**
 * Calculates energy load points for a single block using the domain formula (hours × energy).
 */
export function calculateBlockEnergyPoints(durationMinutes: number, energy: number): number {
  return energyPoints(durationMinutes, energy);
}

/**
 * Calculates total energy load points for a collection of blocks.
 */
export function calculateDayEnergyPoints(
  blocks: readonly { readonly durationMinutes: number; readonly energy: number }[],
): number {
  return blocks.reduce(
    (total, block) => total + calculateBlockEnergyPoints(block.durationMinutes, block.energy),
    0,
  );
}

/**
 * Checks whether the total day load exceeds the user's effective daily limit (FR-55).
 * When exceeded, returns a warning in Polish.
 */
export function checkDayLoadWarning(
  totalDayPoints: number,
  effectiveLimit: number,
): WarningLoadResult {
  if (totalDayPoints > effectiveLimit) {
    return {
      hasWarning: true,
      warning: `Uwaga: obciążenie w tym dniu (${totalDayPoints} pkt) przekracza Twój limit (${effectiveLimit} pkt)`,
      totalDayPoints,
      effectiveLimit,
    };
  }

  return {
    hasWarning: false,
    totalDayPoints,
    effectiveLimit,
  };
}
