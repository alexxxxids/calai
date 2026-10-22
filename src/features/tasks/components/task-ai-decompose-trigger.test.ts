import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/ai/components/ai-decompose-dialog', () => ({
  AiDecomposeDialog: ({ open }: { open: boolean }) =>
    React.createElement('div', { 'data-testid': 'mock-ai-dialog', 'data-open': String(open) }),
}));

import {
  NO_TYPE_DISABLED_HINT,
  ONE_OFF_DISABLED_HINT,
  TaskAiDecomposeTrigger,
  TRIGGER_BUTTON_LABEL,
} from './task-ai-decompose-trigger';

describe('TaskAiDecomposeTrigger', () => {
  const mockTypes = [
    { id: 'type-1', name: 'Matematyka', is_one_off: false },
    { id: 'type-2', name: 'Jednorazowe', is_one_off: true },
  ];

  it('renders disabled button with hint when typeId is null', () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskAiDecomposeTrigger, {
        typeId: null,
        taskTypes: mockTypes,
      }),
    );

    expect(html).toContain('disabled');
    expect(html).toContain(NO_TYPE_DISABLED_HINT);
    expect(html).toContain(TRIGGER_BUTTON_LABEL);
  });

  it('renders disabled button with hint when type is one-off', () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskAiDecomposeTrigger, {
        typeId: 'type-2',
        taskTypes: mockTypes,
      }),
    );

    expect(html).toContain('disabled');
    expect(html).toContain(ONE_OFF_DISABLED_HINT);
  });

  it('renders enabled button when valid regular type is selected', () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskAiDecomposeTrigger, {
        typeId: 'type-1',
        taskTypes: mockTypes,
      }),
    );

    expect(html).not.toContain('disabled=""');
    expect(html).toContain(TRIGGER_BUTTON_LABEL);
  });

  it('renders disabled button when disabled prop is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskAiDecomposeTrigger, {
        typeId: 'type-1',
        taskTypes: mockTypes,
        disabled: true,
      }),
    );

    expect(html).toContain('disabled');
  });
});
