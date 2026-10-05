import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DropInfo, EventDropInfo, EventResizeDoneInfo, EventSourceFuncInfo } from '@fullcalendar/react';

vi.mock('server-only', () => ({}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/features/blocks/actions', () => ({
  moveBlock: vi.fn(),
  scheduleTaskBlock: vi.fn(),
}));

import { toast } from 'sonner';
import { moveBlock, scheduleTaskBlock } from '@/features/blocks/actions';
import {
  executeEventDrop,
  executeEventResize,
  executeExternalDrop,
  fetchCalendarEvents,
  type CalendarActionContext,
} from './calendar-view';

describe('calendar-view async action error handling (hypotheses G1 and G2)', () => {
  const mockRefetch = vi.fn();
  const mockOnBlockUpdated = vi.fn();
  const mockContext: CalendarActionContext = {
    workStart: '08:00',
    timeZone: 'Europe/Warsaw',
    refetch: mockRefetch,
    onBlockUpdated: mockOnBlockUpdated,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('G1: executeEventDrop network failure handling', () => {
    it('should revert event and show toast error when moveBlock throws network exception', async () => {
      // Arrange
      const mockRevert = vi.fn();
      const mockDropInfo = {
        event: {
          id: 'block-1',
          start: new Date('2026-10-05T09:00:00.000Z'),
          end: new Date('2026-10-05T10:30:00.000Z'),
          startStr: '2026-10-05T09:00:00.000Z',
          allDay: false,
        },
        oldEvent: {
          start: new Date('2026-10-05T08:00:00.000Z'),
          end: new Date('2026-10-05T09:30:00.000Z'),
        },
        revert: mockRevert,
      } as unknown as EventDropInfo;

      vi.mocked(moveBlock).mockRejectedValueOnce(new Error('Network failure'));

      // Act & Assert
      await expect(executeEventDrop(mockDropInfo, mockContext)).resolves.not.toThrow();

      expect(mockRevert).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith('Błąd połączenia');
      expect(mockRefetch).not.toHaveBeenCalled();
      expect(mockOnBlockUpdated).not.toHaveBeenCalled();
    });
  });

  describe('G1: executeEventResize network failure handling', () => {
    it('should revert event and show toast error when moveBlock throws during resize', async () => {
      // Arrange
      const mockRevert = vi.fn();
      const mockResizeInfo = {
        event: {
          id: 'block-1',
          start: new Date('2026-10-05T08:00:00.000Z'),
          end: new Date('2026-10-05T10:00:00.000Z'),
        },
        revert: mockRevert,
      } as unknown as EventResizeDoneInfo;

      vi.mocked(moveBlock).mockRejectedValueOnce(new Error('Network failure'));

      // Act & Assert
      await expect(executeEventResize(mockResizeInfo, mockContext)).resolves.not.toThrow();

      expect(mockRevert).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith('Błąd połączenia');
      expect(mockRefetch).not.toHaveBeenCalled();
      expect(mockOnBlockUpdated).not.toHaveBeenCalled();
    });
  });

  describe('G1: executeExternalDrop network failure handling', () => {
    it('should show toast error and catch exception when scheduleTaskBlock throws', async () => {
      // Arrange
      const mockDropInfo = {
        draggedEl: {
          getAttribute: (attr: string) => {
            if (attr === 'data-task-id') return 'task-123';
            if (attr === 'data-task-duration') return '01:30';
            return null;
          },
        },
        date: new Date('2026-10-05T08:00:00.000Z'),
        allDay: false,
      } as unknown as DropInfo;

      vi.mocked(scheduleTaskBlock).mockRejectedValueOnce(new Error('Network failure'));

      // Act & Assert
      await expect(executeExternalDrop(mockDropInfo, mockContext)).resolves.not.toThrow();

      expect(toast.error).toHaveBeenCalledWith('Błąd połączenia');
      expect(mockRefetch).not.toHaveBeenCalled();
      expect(mockOnBlockUpdated).not.toHaveBeenCalled();
    });
  });

  describe('G2: fetchCalendarEvents network and json error handling', () => {
    it('should catch network failure, show toast error and return empty array when fetch rejects', async () => {
      // Arrange
      const mockFetchInfo = {
        startStr: '2026-10-05T00:00:00.000Z',
        endStr: '2026-10-12T00:00:00.000Z',
      } as unknown as EventSourceFuncInfo;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

      // Act & Assert
      let result;
      await expect(
        (async () => {
          result = await fetchCalendarEvents(mockFetchInfo);
        })(),
      ).resolves.not.toThrow();

      expect(result).toEqual([]);
      expect(toast.error).toHaveBeenCalledWith('Błąd połączenia');

      fetchSpy.mockRestore();
    });

    it('should catch malformed json failure, show toast error and return empty array when json throws', async () => {
      // Arrange
      const mockFetchInfo = {
        startStr: '2026-10-05T00:00:00.000Z',
        endStr: '2026-10-12T00:00:00.000Z',
      } as unknown as EventSourceFuncInfo;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0')),
      } as Response);

      // Act & Assert
      let result;
      await expect(
        (async () => {
          result = await fetchCalendarEvents(mockFetchInfo);
        })(),
      ).resolves.not.toThrow();

      expect(result).toEqual([]);
      expect(toast.error).toHaveBeenCalledWith('Błąd połączenia');

      fetchSpy.mockRestore();
    });
  });
});
