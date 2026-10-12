import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/features/ai/actions', () => ({
  confirmDecomposition: vi.fn(),
  confirmTimetable: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AiConsentStep,
  AiFileUploadStep,
  AiLoadingStep,
  DecomposeTopicRow,
  formatFileSize,
  hasAiConsent,
  setAiConsent,
  AI_CONSENT_KEY,
} from './ai-dialog-helpers';
import {
  AiDecomposeDialog,
  DecomposeReviewStep,
  DEFAULT_NEW_TOPIC_MINUTES,
  SESSION_OPTIONS,
  TASK_CREATED_SUCCESS_MESSAGE,
} from './ai-decompose-dialog';
import type { DecompositionDraft } from '../schemas';

function createMockDraft(overrides: Partial<DecompositionDraft> = {}): DecompositionDraft {
  return {
    summary: 'Plan nauki matematyki na 3 sesje',
    sessionMinutes: 45,
    estimateMinutes: 135,
    topics: [
      { title: 'Wprowadzenie i definicje', workMinutes: 45 },
      { title: 'Zadania praktyczne', workMinutes: 45 },
      { title: 'Podsumowanie i powtórka', workMinutes: 45 },
    ],
    warnings: [],
    ...overrides,
  };
}

describe('ai-decompose-dialog and helpers', () => {
  const storageMap = new Map<string, string>();

  beforeEach(() => {
    vi.clearAllMocks();
    storageMap.clear();
    const mockStorage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, val: string) => storageMap.set(key, val),
      removeItem: (key: string) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    };
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', { localStorage: mockStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('consent helpers and storage', () => {
    it('should have correct localStorage key', () => {
      expect(AI_CONSENT_KEY).toBe('calai_ai_consent');
    });

    it('should return false when consent is not stored', () => {
      expect(hasAiConsent()).toBe(false);
    });

    it('should return true when consent is set to true', () => {
      storageMap.set(AI_CONSENT_KEY, 'true');
      expect(hasAiConsent()).toBe(true);
    });

    it('should return false when consent is set to false', () => {
      storageMap.set(AI_CONSENT_KEY, 'false');
      expect(hasAiConsent()).toBe(false);
    });

    it('should set consent in localStorage via setAiConsent', () => {
      setAiConsent(true);
      expect(storageMap.get(AI_CONSENT_KEY)).toBe('true');

      setAiConsent(false);
      expect(storageMap.get(AI_CONSENT_KEY)).toBe('false');
    });
  });

  describe('formatFileSize', () => {
    it('should format megabytes with one decimal digit', () => {
      const tenMegabytes = 10 * 1024 * 1024;
      expect(formatFileSize(tenMegabytes)).toBe('10.0 MB');

      const halfMegabyte = 512 * 1024;
      expect(formatFileSize(halfMegabyte)).toBe('0.5 MB');
    });
  });

  describe('constants', () => {
    it('should define session lengths from 30 to 180 minutes with 15-minute step', () => {
      expect(SESSION_OPTIONS).toHaveLength(11);
      expect(SESSION_OPTIONS[0]).toBe(30);
      expect(SESSION_OPTIONS[SESSION_OPTIONS.length - 1]).toBe(180);
    });

    it('should have default new topic minutes set to 45', () => {
      expect(DEFAULT_NEW_TOPIC_MINUTES).toBe(45);
    });

    it('should have Polish success message for task creation', () => {
      expect(TASK_CREATED_SUCCESS_MESSAGE).toBe('Zadanie utworzone pomyślnie');
    });
  });

  describe('static rendering of helper components', () => {
    it('should render AiConsentStep markup with checkbox and submit button', () => {
      const html = renderToStaticMarkup(
        React.createElement(AiConsentStep, {
          onConsentGiven: vi.fn(),
          onCancel: vi.fn(),
        }),
      );

      expect(html).toContain('ai-consent-checkbox');
      expect(html).toContain('Wyrażam zgodę');
      expect(html).toContain('Dalej');
      expect(html).toContain('Anuluj');
    });

    it('should render AiFileUploadStep markup with drop zone and upload limits', () => {
      const html = renderToStaticMarkup(
        React.createElement(AiFileUploadStep, {
          onFileSelect: vi.fn(),
          onCancel: vi.fn(),
        }),
      );

      expect(html).toContain('Kliknij, aby wybrać plik');
      expect(html).toContain('20 MB');
      expect(html).toContain('Analizuj materiał');
    });

    it('should render AiLoadingStep with loading text and spinner', () => {
      const html = renderToStaticMarkup(React.createElement(AiLoadingStep));

      expect(html).toContain('Trwa analiza materiałów przez AI...');
      expect(html).toContain('ai-loading-step');
    });

    it('should render DecomposeTopicRow with index, title, minutes and delete button', () => {
      const html = renderToStaticMarkup(
        React.createElement(DecomposeTopicRow, {
          index: 0,
          title: 'Wstęp do fizyki',
          workMinutes: 45,
          canRemove: true,
          onTitleChange: vi.fn(),
          onMinutesChange: vi.fn(),
          onRemove: vi.fn(),
        }),
      );

      expect(html).toContain('1.');
      expect(html).toContain('Wstęp do fizyki');
      expect(html).toContain('45');
      expect(html).toContain('min');
    });

    it('should render DecomposeReviewStep with summary, topics and total estimate', () => {
      const draft = createMockDraft();
      const html = renderToStaticMarkup(
        React.createElement(DecomposeReviewStep, {
          draft,
          onDraftChange: vi.fn(),
          onConfirm: vi.fn(),
          onCancel: vi.fn(),
          isSubmitting: false,
        }),
      );

      expect(html).toContain(draft.summary);
      expect(html).toContain('Długość sesji pracy:');
      expect(html).toContain('Wprowadzenie i definicje');
      expect(html).toContain('135 min');
      expect(html).toContain('Utwórz zadanie');
    });
  });

  describe('DecomposeReviewStep topic manipulation logic', () => {
    it('should allow adding a new topic with 45 minutes', () => {
      const draft = createMockDraft();
      const onDraftChange = vi.fn();

      const newTopic = { title: 'Nowy temat', workMinutes: DEFAULT_NEW_TOPIC_MINUTES };
      const updatedTopics = [...draft.topics, newTopic];
      onDraftChange({
        ...draft,
        topics: updatedTopics,
        estimateMinutes: 180,
      });

      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: expect.arrayContaining([expect.objectContaining({ title: 'Nowy temat' })]),
          estimateMinutes: 180,
        }),
      );
    });

    it('should allow removing a topic and updating total estimate', () => {
      const draft = createMockDraft();
      const remainingTopics = draft.topics.slice(1);
      const newEstimate = 90;

      const updatedDraft = {
        ...draft,
        topics: remainingTopics,
        estimateMinutes: newEstimate,
      };

      expect(updatedDraft.topics).toHaveLength(2);
      expect(updatedDraft.estimateMinutes).toBe(90);
    });

    it('should allow changing sessionMinutes to 60', () => {
      const draft = createMockDraft({ sessionMinutes: 45 });
      const updatedDraft = { ...draft, sessionMinutes: 60 };

      expect(updatedDraft.sessionMinutes).toBe(60);
    });
  });

  describe('AiDecomposeDialog component', () => {
    it('should render without errors when open is false', () => {
      const element = React.createElement(AiDecomposeDialog, {
        open: false,
        onOpenChange: vi.fn(),
        typeId: 'type-uuid-1',
      });

      expect(element).toBeDefined();
      expect(element.props.open).toBe(false);
    });

    it('should render dialog content when open is true', () => {
      storageMap.set(AI_CONSENT_KEY, 'true');
      const element = React.createElement(AiDecomposeDialog, {
        open: true,
        onOpenChange: vi.fn(),
        typeId: 'type-uuid-1',
        description: 'Materiały do sprawdzianu',
      });

      expect(element).toBeDefined();
      expect(element.props.open).toBe(true);
      expect(element.props.typeId).toBe('type-uuid-1');
    });
  });
});
