import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/ai/components/timetable-import-dialog', () => ({
  TimetableImportDialog: ({ open }: { open: boolean }) =>
    React.createElement('div', { 'data-testid': 'mock-timetable-dialog', 'data-open': String(open) }),
}));

import {
  TIMETABLE_TRIGGER_LABEL,
  TimetableImportTrigger,
} from './timetable-import-trigger';

describe('TimetableImportTrigger', () => {
  const mockTypes = [
    { id: 'type-1', name: 'Szkoła' },
  ];

  it('renders disabled button when taskTypes is empty or undefined', () => {
    const html = renderToStaticMarkup(
      React.createElement(TimetableImportTrigger, {
        taskTypes: [],
      }),
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain(TIMETABLE_TRIGGER_LABEL);
  });

  it('renders enabled button when valid default task type is present', () => {
    const html = renderToStaticMarkup(
      React.createElement(TimetableImportTrigger, {
        taskTypes: mockTypes,
      }),
    );

    expect(html).not.toContain('disabled=""');
    expect(html).toContain(TIMETABLE_TRIGGER_LABEL);
  });

  it('renders disabled button when disabled prop is set to true', () => {
    const html = renderToStaticMarkup(
      React.createElement(TimetableImportTrigger, {
        taskTypes: mockTypes,
        disabled: true,
      }),
    );

    expect(html).toContain('disabled=""');
  });
});
