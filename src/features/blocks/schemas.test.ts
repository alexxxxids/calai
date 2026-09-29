import { describe, expect, it } from 'vitest';
import {
  CloseBlockSchema,
  DeleteBlockSchema,
  MoveBlockSchema,
  ScheduleBlockSchema,
} from './schemas';

describe('blocks schemas', () => {
  const validTaskId = '11111111-1111-4111-8111-111111111111';
  const validBlockId = '22222222-2222-4222-8222-222222222222';

  describe('ScheduleBlockSchema', () => {
    it('accepts valid schedule block input', () => {
      const input = {
        taskId: validTaskId,
        start: '2026-10-05T08:00:00.000Z',
        durationMinutes: 60,
      };

      const result = ScheduleBlockSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.taskId).toBe(validTaskId);
        expect(result.data.start).toBe('2026-10-05T08:00:00.000Z');
        expect(result.data.durationMinutes).toBe(60);
      }
    });

    it('accepts minimum block duration of 15 minutes', () => {
      const result = ScheduleBlockSchema.safeParse({
        taskId: validTaskId,
        start: '2026-10-05T08:00:00Z',
        durationMinutes: 15,
      });

      expect(result.success).toBe(true);
    });

    it('accepts maximum block duration of 720 minutes', () => {
      const result = ScheduleBlockSchema.safeParse({
        taskId: validTaskId,
        start: '2026-10-05T08:00:00Z',
        durationMinutes: 720,
      });

      expect(result.success).toBe(true);
    });

    it('rejects duration shorter than 15 minutes', () => {
      const result = ScheduleBlockSchema.safeParse({
        taskId: validTaskId,
        start: '2026-10-05T08:00:00Z',
        durationMinutes: 14,
      });

      expect(result.success).toBe(false);
    });

    it('rejects duration longer than 720 minutes', () => {
      const result = ScheduleBlockSchema.safeParse({
        taskId: validTaskId,
        start: '2026-10-05T08:00:00Z',
        durationMinutes: 721,
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-integer duration', () => {
      const result = ScheduleBlockSchema.safeParse({
        taskId: validTaskId,
        start: '2026-10-05T08:00:00Z',
        durationMinutes: 45.5,
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-UUID taskId', () => {
      const result = ScheduleBlockSchema.safeParse({
        taskId: 'invalid-id',
        start: '2026-10-05T08:00:00Z',
        durationMinutes: 60,
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid start datetime string', () => {
      const result = ScheduleBlockSchema.safeParse({
        taskId: validTaskId,
        start: 'not-a-datetime',
        durationMinutes: 60,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('MoveBlockSchema', () => {
    it('accepts valid move block input', () => {
      const input = {
        blockId: validBlockId,
        start: '2026-10-05T08:00:00.000Z',
        end: '2026-10-05T09:30:00.000Z',
      };

      const result = MoveBlockSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.blockId).toBe(validBlockId);
      }
    });

    it('accepts duration up to 12 hours (720 minutes)', () => {
      const result = MoveBlockSchema.safeParse({
        blockId: validBlockId,
        start: '2026-10-05T08:00:00Z',
        end: '2026-10-05T20:00:00Z',
      });

      expect(result.success).toBe(true);
    });

    it('rejects when end is equal to start', () => {
      const result = MoveBlockSchema.safeParse({
        blockId: validBlockId,
        start: '2026-10-05T08:00:00Z',
        end: '2026-10-05T08:00:00Z',
      });

      expect(result.success).toBe(false);
    });

    it('rejects when end is earlier than start', () => {
      const result = MoveBlockSchema.safeParse({
        blockId: validBlockId,
        start: '2026-10-05T10:00:00Z',
        end: '2026-10-05T08:00:00Z',
      });

      expect(result.success).toBe(false);
    });

    it('rejects duration shorter than minimum 15 minutes (e.g. 1 millisecond)', () => {
      const result = MoveBlockSchema.safeParse({
        blockId: validBlockId,
        start: '2026-10-05T10:00:00.000Z',
        end: '2026-10-05T10:00:00.001Z',
      });

      expect(result.success).toBe(false);
    });

    it('rejects duration of 14 minutes', () => {
      const result = MoveBlockSchema.safeParse({
        blockId: validBlockId,
        start: '2026-10-05T10:00:00.000Z',
        end: '2026-10-05T10:14:00.000Z',
      });

      expect(result.success).toBe(false);
    });

    it('rejects duration exceeding 12 hours', () => {
      const result = MoveBlockSchema.safeParse({
        blockId: validBlockId,
        start: '2026-10-05T08:00:00Z',
        end: '2026-10-05T20:01:00Z',
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-UUID blockId', () => {
      const result = MoveBlockSchema.safeParse({
        blockId: 'not-a-uuid',
        start: '2026-10-05T08:00:00Z',
        end: '2026-10-05T09:00:00Z',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid datetime in start or end', () => {
      expect(
        MoveBlockSchema.safeParse({
          blockId: validBlockId,
          start: 'invalid',
          end: '2026-10-05T09:00:00Z',
        }).success,
      ).toBe(false);

      expect(
        MoveBlockSchema.safeParse({
          blockId: validBlockId,
          start: '2026-10-05T08:00:00Z',
          end: 'invalid',
        }).success,
      ).toBe(false);
    });
  });

  describe('CloseBlockSchema', () => {
    it('accepts status "done" with valid actualMinutes', () => {
      const result = CloseBlockSchema.safeParse({
        blockId: validBlockId,
        status: 'done',
        actualMinutes: 60,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('done');
        expect(result.data.actualMinutes).toBe(60);
      }
    });

    it('accepts status "done" with boundary actualMinutes 1 and 1440', () => {
      expect(
        CloseBlockSchema.safeParse({
          blockId: validBlockId,
          status: 'done',
          actualMinutes: 1,
        }).success,
      ).toBe(true);

      expect(
        CloseBlockSchema.safeParse({
          blockId: validBlockId,
          status: 'done',
          actualMinutes: 1440,
        }).success,
      ).toBe(true);
    });

    it('rejects status "done" when actualMinutes is omitted', () => {
      const result = CloseBlockSchema.safeParse({
        blockId: validBlockId,
        status: 'done',
      });

      expect(result.success).toBe(false);
    });

    it('rejects status "done" when actualMinutes is null', () => {
      const result = CloseBlockSchema.safeParse({
        blockId: validBlockId,
        status: 'done',
        actualMinutes: null,
      });

      expect(result.success).toBe(false);
    });

    it('rejects status "done" when actualMinutes is 0', () => {
      const result = CloseBlockSchema.safeParse({
        blockId: validBlockId,
        status: 'done',
        actualMinutes: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects status "done" when actualMinutes exceeds 1440', () => {
      const result = CloseBlockSchema.safeParse({
        blockId: validBlockId,
        status: 'done',
        actualMinutes: 1441,
      });

      expect(result.success).toBe(false);
    });

    it('rejects status "done" when actualMinutes is negative', () => {
      const result = CloseBlockSchema.safeParse({
        blockId: validBlockId,
        status: 'done',
        actualMinutes: -15,
      });

      expect(result.success).toBe(false);
    });

    it('accepts status "missed" without actualMinutes', () => {
      const result = CloseBlockSchema.safeParse({
        blockId: validBlockId,
        status: 'missed',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('missed');
        expect(result.data.actualMinutes).toBeUndefined();
      }
    });

    it('accepts status "missed" with actualMinutes set to null', () => {
      const result = CloseBlockSchema.safeParse({
        blockId: validBlockId,
        status: 'missed',
        actualMinutes: null,
      });

      expect(result.success).toBe(true);
    });

    it('accepts status "missed" with actualMinutes provided', () => {
      const result = CloseBlockSchema.safeParse({
        blockId: validBlockId,
        status: 'missed',
        actualMinutes: 30,
      });

      expect(result.success).toBe(true);
    });

    it('rejects unknown status value', () => {
      const result = CloseBlockSchema.safeParse({
        blockId: validBlockId,
        status: 'cancelled',
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-UUID blockId', () => {
      const result = CloseBlockSchema.safeParse({
        blockId: 'bad-id',
        status: 'missed',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('DeleteBlockSchema', () => {
    it('accepts valid UUID blockId', () => {
      const result = DeleteBlockSchema.safeParse({
        blockId: validBlockId,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.blockId).toBe(validBlockId);
      }
    });

    it('rejects non-UUID blockId', () => {
      const result = DeleteBlockSchema.safeParse({
        blockId: 'not-a-uuid',
      });

      expect(result.success).toBe(false);
    });
  });
});
