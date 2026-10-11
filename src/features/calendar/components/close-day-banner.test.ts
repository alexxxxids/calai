import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/features/blocks/actions', () => ({
  closeBlock: vi.fn(),
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { toast } from 'sonner';
import { closeBlock } from '@/features/blocks/actions';
import type { UnclosedBlockItem } from '@/features/blocks/types';
import { CloseDayBanner, executeCloseDayBlock } from './close-day-banner';

function createMockUnclosedBlock(
  overrides: Partial<UnclosedBlockItem> = {},
): UnclosedBlockItem {
  return {
    id: 'block-test-1',
    taskId: 'task-test-1',
    startsAt: '2026-10-11T08:00:00.000Z',
    endsAt: '2026-10-11T09:30:00.000Z',
    workMinutes: 90,
    typeName: 'Matematyka',
    typeColor: '#3b82f6',
    typeEnergy: 2,
    notes: 'Zadania ze strony 42',
    ...overrides,
  };
}

describe('close-day-banner component and actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CloseDayBanner rendering and markup', () => {
    it('should return null and empty markup when unclosedBlocks is empty', () => {
      // Arrange
      const emptyBlocks: readonly UnclosedBlockItem[] = [];

      // Act
      const html = renderToStaticMarkup(
        React.createElement(CloseDayBanner, { unclosedBlocks: emptyBlocks }),
      );

      // Assert
      expect(html).toBe('');
    });

    it('should render header with count, description, and block details when blocks exist', () => {
      // Arrange
      const blocks: readonly UnclosedBlockItem[] = [
        createMockUnclosedBlock({
          id: 'b-1',
          typeName: 'Matematyka',
          workMinutes: 90,
        }),
        createMockUnclosedBlock({
          id: 'b-2',
          typeName: 'Historia',
          workMinutes: 45,
          notes: 'Powtórka dat',
          startsAt: '2026-10-11T10:00:00.000Z',
          endsAt: '2026-10-11T10:45:00.000Z',
        }),
      ];

      // Act
      const html = renderToStaticMarkup(
        React.createElement(CloseDayBanner, {
          unclosedBlocks: blocks,
          timeZone: 'Europe/Warsaw',
        }),
      );

      // Assert
      expect(html).toContain('Niezamknięte bloki (2)');
      expect(html).toContain('Rozlicz zakończone bloki, aby zaktualizować statystyki i kalibrację tempa.');
      expect(html).toContain('Matematyka');
      expect(html).toContain('Historia');
      expect(html).toContain('1 h 30 min');
      expect(html).toContain('45 min');
      expect(html).toContain('Powtórka dat');
      expect(html).toContain('Zrobione');
      expect(html).toContain('Nie zrobione');
      expect(html).toContain('background-color:#3b82f6');
    });

    it('should render cleanly without notes when block notes is null', () => {
      // Arrange
      const blockWithoutNotes = [
        createMockUnclosedBlock({
          id: 'b-no-notes',
          typeName: 'Język polski',
          notes: null,
        }),
      ];

      // Act
      const html = renderToStaticMarkup(
        React.createElement(CloseDayBanner, {
          unclosedBlocks: blockWithoutNotes,
        }),
      );

      // Assert
      expect(html).toContain('Język polski');
      expect(html).not.toContain('Zadania ze strony 42');
    });

    it('should render localized time range according to specified timeZone', () => {
      // Arrange
      const blocks = [
        createMockUnclosedBlock({
          startsAt: '2026-10-11T08:00:00.000Z',
          endsAt: '2026-10-11T09:30:00.000Z',
        }),
      ];

      // Act
      const htmlUtc = renderToStaticMarkup(
        React.createElement(CloseDayBanner, {
          unclosedBlocks: blocks,
          timeZone: 'UTC',
        }),
      );

      // Assert
      expect(htmlUtc).toContain('08:00 – 09:30');
    });

    it('should disable action buttons for all blocks when any block is pending', () => {
      // Arrange
      const blocks: readonly UnclosedBlockItem[] = [
        createMockUnclosedBlock({ id: 'b-1', typeName: 'Matematyka' }),
        createMockUnclosedBlock({ id: 'b-2', typeName: 'Historia' }),
      ];

      // Act
      const html = renderToStaticMarkup(
        React.createElement(CloseDayBanner, {
          unclosedBlocks: blocks,
          pendingBlockId: 'b-1',
        }),
      );

      // Match disabled buttons for each block
      expect(html).toMatch(/data-testid="unclosed-block-b-1"[\s\S]*?disabled/);
      expect(html).toMatch(/data-testid="unclosed-block-b-2"[\s\S]*?disabled/);
      // Both blocks should have disabled buttons
      const disabledCount = (html.match(/disabled=""/g) ?? html.match(/disabled(?=[ >])/g) ?? []).length;
      expect(disabledCount).toBe(4);
    });
  });

  describe('executeCloseDayBlock action handling', () => {
    it('should call closeBlock with status done and actualMinutes when status is done', async () => {
      // Arrange
      const mockAction = vi.fn().mockResolvedValue({ ok: true, data: { success: true } });
      const onBlockClosed = vi.fn();

      // Act
      const result = await executeCloseDayBlock({
        blockId: 'block-123',
        status: 'done',
        actualMinutes: 90,
        closeAction: mockAction,
        onBlockClosed,
      });

      // Assert
      expect(result).toBe(true);
      expect(mockAction).toHaveBeenCalledWith({
        blockId: 'block-123',
        status: 'done',
        actualMinutes: 90,
      });
      expect(toast.success).toHaveBeenCalledWith('Blok oznaczony jako zrobiony');
      expect(onBlockClosed).toHaveBeenCalledWith('block-123');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should fallback actualMinutes to MIN_ACTUAL_MINUTES when actualMinutes is not provided for done status', async () => {
      // Arrange
      const mockAction = vi.fn().mockResolvedValue({ ok: true, data: { success: true } });

      // Act
      const result = await executeCloseDayBlock({
        blockId: 'block-123',
        status: 'done',
        closeAction: mockAction,
      });

      // Assert
      expect(result).toBe(true);
      expect(mockAction).toHaveBeenCalledWith({
        blockId: 'block-123',
        status: 'done',
        actualMinutes: 1,
      });
    });

    it('should call closeBlock with status missed without actualMinutes when status is missed', async () => {
      // Arrange
      const mockAction = vi.fn().mockResolvedValue({ ok: true, data: { success: true } });
      const onBlockClosed = vi.fn();

      // Act
      const result = await executeCloseDayBlock({
        blockId: 'block-456',
        status: 'missed',
        closeAction: mockAction,
        onBlockClosed,
      });

      // Assert
      expect(result).toBe(true);
      expect(mockAction).toHaveBeenCalledWith({
        blockId: 'block-456',
        status: 'missed',
      });
      expect(toast.success).toHaveBeenCalledWith('Blok oznaczony jako nie zrobiony');
      expect(onBlockClosed).toHaveBeenCalledWith('block-456');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should use default closeBlock export when closeAction is omitted', async () => {
      // Arrange
      vi.mocked(closeBlock).mockResolvedValueOnce({ ok: true, data: { success: true } });

      // Act
      const result = await executeCloseDayBlock({
        blockId: 'block-default',
        status: 'done',
        actualMinutes: 45,
      });

      // Assert
      expect(result).toBe(true);
      expect(closeBlock).toHaveBeenCalledWith({
        blockId: 'block-default',
        status: 'done',
        actualMinutes: 45,
      });
      expect(toast.success).toHaveBeenCalledWith('Blok oznaczony jako zrobiony');
    });
  });

  describe('error handling and toast notifications', () => {
    it('should show toast.error with server error message when action returns ok false', async () => {
      // Arrange
      const mockAction = vi.fn().mockResolvedValue({
        ok: false,
        error: 'Blok został już rozliczony',
      });
      const onBlockClosed = vi.fn();

      // Act
      const result = await executeCloseDayBlock({
        blockId: 'block-err-1',
        status: 'done',
        actualMinutes: 60,
        closeAction: mockAction,
        onBlockClosed,
      });

      // Assert
      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Blok został już rozliczony');
      expect(toast.success).not.toHaveBeenCalled();
      expect(onBlockClosed).not.toHaveBeenCalled();
    });

    it('should show toast.error with fallback message when action returns ok false without error', async () => {
      // Arrange
      const mockAction = vi.fn().mockResolvedValue({
        ok: false,
      });
      const onBlockClosed = vi.fn();

      // Act
      const result = await executeCloseDayBlock({
        blockId: 'block-err-2',
        status: 'missed',
        closeAction: mockAction,
        onBlockClosed,
      });

      // Assert
      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Nie udało się rozliczyć bloku');
      expect(toast.success).not.toHaveBeenCalled();
      expect(onBlockClosed).not.toHaveBeenCalled();
    });

    it('should catch network exception and show connection error toast', async () => {
      // Arrange
      const mockAction = vi.fn().mockRejectedValue(new Error('Network offline'));
      const onBlockClosed = vi.fn();

      // Act
      const result = await executeCloseDayBlock({
        blockId: 'block-net-err',
        status: 'done',
        actualMinutes: 60,
        closeAction: mockAction,
        onBlockClosed,
      });

      // Assert
      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Błąd połączenia');
      expect(toast.success).not.toHaveBeenCalled();
      expect(onBlockClosed).not.toHaveBeenCalled();
    });
  });
});
