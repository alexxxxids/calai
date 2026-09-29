import { describe, expect, it } from 'vitest';
import {
  calculateBlockEnergyPoints,
  calculateDayEnergyPoints,
  checkDayLoadWarning,
} from './load-warning';

describe('load-warning', () => {
  describe('calculateBlockEnergyPoints', () => {
    it('calculates energy points for a 60-minute block with energy 2 (2 points)', () => {
      expect(calculateBlockEnergyPoints(60, 2)).toBe(2);
    });

    it('calculates energy points for a 90-minute block with energy 3 (4.5 points)', () => {
      expect(calculateBlockEnergyPoints(90, 3)).toBe(4.5);
    });

    it('calculates energy points for a 30-minute block with energy 1 (0.5 points)', () => {
      expect(calculateBlockEnergyPoints(30, 1)).toBe(0.5);
    });

    it('returns 0 points for a recovery block with energy 0', () => {
      expect(calculateBlockEnergyPoints(60, 0)).toBe(0);
    });
  });

  describe('calculateDayEnergyPoints', () => {
    it('sums energy points of multiple blocks', () => {
      const blocks = [
        { durationMinutes: 60, energy: 2 }, // 2.0
        { durationMinutes: 90, energy: 3 }, // 4.5
        { durationMinutes: 30, energy: 1 }, // 0.5
      ];

      expect(calculateDayEnergyPoints(blocks)).toBe(7);
    });

    it('returns 0 for an empty block list', () => {
      expect(calculateDayEnergyPoints([])).toBe(0);
    });
  });

  describe('checkDayLoadWarning', () => {
    it('returns hasWarning false when load is within limit (15 points with limit 20)', () => {
      const result = checkDayLoadWarning(15, 20);

      expect(result).toEqual({
        hasWarning: false,
        totalDayPoints: 15,
        effectiveLimit: 20,
      });
      expect(result.warning).toBeUndefined();
    });

    it('returns hasWarning false when load is exactly at limit (20 points with limit 20)', () => {
      const result = checkDayLoadWarning(20, 20);

      expect(result).toEqual({
        hasWarning: false,
        totalDayPoints: 20,
        effectiveLimit: 20,
      });
      expect(result.warning).toBeUndefined();
    });

    it('returns hasWarning true with formatted Polish message when load exceeds limit (22 points with limit 20)', () => {
      const result = checkDayLoadWarning(22, 20);

      expect(result).toEqual({
        hasWarning: true,
        warning: 'Uwaga: obciążenie w tym dniu (22 pkt) przekracza Twój limit (20 pkt)',
        totalDayPoints: 22,
        effectiveLimit: 20,
      });
    });

    it('formats fractional points correctly in warning message', () => {
      const result = checkDayLoadWarning(20.5, 20);

      expect(result.hasWarning).toBe(true);
      expect(result.warning).toBe(
        'Uwaga: obciążenie w tym dniu (20.5 pkt) przekracza Twój limit (20 pkt)',
      );
    });
  });
});
