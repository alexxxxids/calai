import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('../actions', () => ({
  deleteAccountAction: vi.fn(),
  exportUserDataAction: vi.fn(),
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AccountSettings,
  DeleteAccountCard,
  DeleteConfirmationField,
  ExportDataCard,
} from './account-settings';
import * as AccountModule from '../index';

describe('features/account/components/ExportDataCard', () => {
  it('renders title, description and download button in initial state', () => {
    const html = renderToStaticMarkup(React.createElement(ExportDataCard));

    expect(html).toContain('Eksport danych');
    expect(html).toContain('Pobierz kopię wszystkich swoich danych w formacie JSON.');
    expect(html).toContain('Pobierz dane (JSON)');
    expect(html).toContain('data-slot="card"');
    expect(html).toContain('data-slot="button"');
  });
});

describe('features/account/components/DeleteAccountCard', () => {
  it('renders card title, warning description and delete button', () => {
    const html = renderToStaticMarkup(React.createElement(DeleteAccountCard));

    expect(html).toContain('Usuwanie konta');
    expect(html).toContain('Trwałe usunięcie konta i wszystkich powiązanych danych.');
    expect(html).toContain('Usuń konto');
    expect(html).toContain('border-destructive/30');
    expect(html).toContain('data-slot="card"');
  });
});

describe('features/account/components/DeleteConfirmationField', () => {
  it('renders confirmation label, placeholder and input value', () => {
    const html = renderToStaticMarkup(
      React.createElement(DeleteConfirmationField, {
        confirmation: 'USU',
        onChange: vi.fn(),
        disabled: false,
        error: null,
      })
    );

    expect(html).toContain('Aby potwierdzić, wpisz USUŃ');
    expect(html).toContain('placeholder="USUŃ"');
    expect(html).toContain('value="USU"');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('text-destructive');
  });

  it('renders disabled input when disabled is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(DeleteConfirmationField, {
        confirmation: 'USUŃ',
        onChange: vi.fn(),
        disabled: true,
        error: null,
      })
    );

    expect(html).toContain('disabled=""');
  });

  it('renders error message with destructive text style when error is provided', () => {
    const errorMessage = 'Wpisz dokładnie „USUŃ”, aby potwierdzić usunięcie konta.';
    const html = renderToStaticMarkup(
      React.createElement(DeleteConfirmationField, {
        confirmation: 'NIE',
        onChange: vi.fn(),
        disabled: false,
        error: errorMessage,
      })
    );

    expect(html).toContain('text-destructive');
    expect(html).toContain(errorMessage);
  });
});

describe('features/account/components/AccountSettings', () => {
  it('renders both ExportDataCard and DeleteAccountCard within layout container', () => {
    const html = renderToStaticMarkup(React.createElement(AccountSettings));

    expect(html).toContain('space-y-6');
    expect(html).toContain('Eksport danych');
    expect(html).toContain('Pobierz dane (JSON)');
    expect(html).toContain('Usuwanie konta');
    expect(html).toContain('Usuń konto');
  });
});

describe('features/account/index public exports', () => {
  it('exports all expected components, actions, schemas and functions', () => {
    expect(AccountModule.AccountSettings).toBeDefined();
    expect(AccountModule.ExportDataCard).toBeDefined();
    expect(AccountModule.DeleteAccountCard).toBeDefined();
    expect(AccountModule.deleteAccountAction).toBeDefined();
    expect(AccountModule.exportUserDataAction).toBeDefined();
    expect(AccountModule.DeleteAccountSchema).toBeDefined();
    expect(AccountModule.exportUserData).toBeDefined();
    expect(AccountModule.buildUserExport).toBeDefined();
    expect(AccountModule.deleteAccount).toBeDefined();
  });
});
