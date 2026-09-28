import { describe, it, expect } from 'vitest';
import {
  normalizeColor,
  CreateTaskTypeSchema,
  UpdateTaskTypeSchema,
  ArchiveTaskTypeSchema,
} from './schemas';

describe('task-types schemas', () => {
  describe('normalizeColor', () => {
    it('normalizes uppercase 6-digit hex to lowercase', () => {
      expect(normalizeColor('#3B82F6')).toBe('#3b82f6');
      expect(normalizeColor('#FFFFFF')).toBe('#ffffff');
      expect(normalizeColor('#000000')).toBe('#000000');
    });

    it('expands 3-digit shorthand hex to 6-digit hex in lowercase', () => {
      expect(normalizeColor('#fff')).toBe('#ffffff');
      expect(normalizeColor('#F0A')).toBe('#ff00aa');
      expect(normalizeColor('#123')).toBe('#112233');
    });

    it('throws on invalid color format', () => {
      expect(() => normalizeColor('red')).toThrow();
      expect(() => normalizeColor('#12')).toThrow();
      expect(() => normalizeColor('#1234567')).toThrow();
      expect(() => normalizeColor('123456')).toThrow();
      expect(() => normalizeColor('#xyz123')).toThrow();
    });
  });

  describe('CreateTaskTypeSchema', () => {
    it('accepts valid input and normalizes color', () => {
      const parsed = CreateTaskTypeSchema.safeParse({
        name: 'Matematyka',
        color: '#3B82F6',
        energy: 2,
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe('Matematyka');
        expect(parsed.data.color).toBe('#3b82f6');
        expect(parsed.data.energy).toBe(2);
      }
    });

    it('rejects empty or whitespace-only name', () => {
      expect(
        CreateTaskTypeSchema.safeParse({
          name: '   ',
          color: '#3b82f6',
          energy: 1,
        }).success
      ).toBe(false);
    });

    it('rejects name exceeding 60 characters', () => {
      expect(
        CreateTaskTypeSchema.safeParse({
          name: 'a'.repeat(61),
          color: '#3b82f6',
          energy: 1,
        }).success
      ).toBe(false);

      expect(
        CreateTaskTypeSchema.safeParse({
          name: 'a'.repeat(60),
          color: '#3b82f6',
          energy: 1,
        }).success
      ).toBe(true);
    });

    it('rejects energy below 0 or above 3', () => {
      expect(
        CreateTaskTypeSchema.safeParse({
          name: 'Nauka',
          color: '#3b82f6',
          energy: -1,
        }).success
      ).toBe(false);

      expect(
        CreateTaskTypeSchema.safeParse({
          name: 'Nauka',
          color: '#3b82f6',
          energy: 4,
        }).success
      ).toBe(false);

      expect(
        CreateTaskTypeSchema.safeParse({
          name: 'Nauka',
          color: '#3b82f6',
          energy: 0,
        }).success
      ).toBe(true);

      expect(
        CreateTaskTypeSchema.safeParse({
          name: 'Nauka',
          color: '#3b82f6',
          energy: 3,
        }).success
      ).toBe(true);
    });
  });

  describe('UpdateTaskTypeSchema', () => {
    it('validates UUID id and fields', () => {
      expect(
        UpdateTaskTypeSchema.safeParse({
          id: 'not-a-uuid',
          name: 'Nauka',
          color: '#3b82f6',
          energy: 1,
        }).success
      ).toBe(false);

      expect(
        UpdateTaskTypeSchema.safeParse({
          id: 'a0000000-0000-4000-8000-000000000001',
          name: 'Nauka',
          color: '#3b82f6',
          energy: 1,
        }).success
      ).toBe(true);
    });
  });

  describe('ArchiveTaskTypeSchema', () => {
    it('validates UUID id', () => {
      expect(
        ArchiveTaskTypeSchema.safeParse({ id: 'a0000000-0000-4000-8000-000000000001' })
          .success
      ).toBe(true);
      expect(ArchiveTaskTypeSchema.safeParse({ id: '123' }).success).toBe(false);
    });
  });
});
