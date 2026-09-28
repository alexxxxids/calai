import { FLOAT_NOISE } from '@/domain/constants';

/**
 * Keeps a value inside [min, max]: below min gives min, above max gives max.
 * Example: clamp(6, 0.25, 4) = 4.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Rounds up to the nearest multiple of step: ceilTo(119.7, 15) = 120, ceilTo(120, 15) = 120.
 * Used for the 15-minute grid, both for minutes and for millisecond instants.
 */
export function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/**
 * Rounds down to the nearest multiple of step: floorTo(134, 15) = 120.
 */
export function floorTo(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

/**
 * Removes floating-point crumbs before rounding: 104.99999999999999 becomes 105, 105.3 stays 105.3.
 * Without it Math.ceil(104.99999999999999 / 15) is 7 but Math.ceil(105.00000000000001 / 15) is 8:
 * a difference of one bit would add a whole 15-minute slot to a block.
 */
export function snapNearInteger(value: number): number {
  const nearest = Math.round(value);
  return Math.abs(value - nearest) < FLOAT_NOISE ? nearest : value;
}
