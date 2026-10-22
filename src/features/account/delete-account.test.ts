import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ServerSupabase } from '@/lib/supabase/server';
import type { CurrentUser } from '@/lib/auth';

vi.mock('server-only', () => ({}));

const mockList = vi.fn();
const mockRemove = vi.fn();
const mockDeleteUser = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        list: mockList,
        remove: mockRemove,
      })),
    },
    auth: {
      admin: {
        deleteUser: mockDeleteUser,
      },
    },
  })),
}));

import { deleteAccount } from './delete-account';

describe('deleteAccount', () => {
  const mockSignOut = vi.fn();
  const mockSupabase = {
    auth: {
      signOut: mockSignOut,
    },
  } as unknown as ServerSupabase;

  const mockUser: CurrentUser = {
    id: 'user-uuid-1234',
    email: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invalidInput when confirmation is invalid', async () => {
    const invalidInputs = [
      { confirmation: 'invalid' },
      { confirmation: 'usun' },
      { confirmation: 'USUN' },
      { confirmation: 123 },
    ];

    for (const input of invalidInputs) {
      const result = await deleteAccount(mockSupabase, mockUser, input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Popraw zaznaczone pola.');
        expect(result.fieldErrors?.confirmation).toBeDefined();
      }
    }

    expect(mockList).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('returns invalidInput when confirmation is missing or non-object', async () => {
    const invalidInputs = [{}, null, undefined, 'USUŃ'];

    for (const input of invalidInputs) {
      const result = await deleteAccount(mockSupabase, mockUser, input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Popraw zaznaczone pola.');
        const hasFieldError =
          result.fieldErrors?.confirmation !== undefined ||
          result.fieldErrors?._form !== undefined;
        expect(hasFieldError).toBe(true);
      }
    }

    expect(mockList).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('successfully cleans up files, deletes user, signs out, and returns ok', async () => {
    mockList.mockResolvedValue({
      data: [{ name: 'upload1.pdf' }, { name: 'photo2.png' }],
      error: null,
    });
    mockRemove.mockResolvedValue({ error: null });
    mockDeleteUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });

    const result = await deleteAccount(mockSupabase, mockUser, { confirmation: 'USUŃ' });

    expect(mockList).toHaveBeenCalledWith('user-uuid-1234');
    expect(mockRemove).toHaveBeenCalledWith([
      'user-uuid-1234/upload1.pdf',
      'user-uuid-1234/photo2.png',
    ]);
    expect(mockDeleteUser).toHaveBeenCalledWith('user-uuid-1234');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(result).toEqual({ ok: true, data: { success: true } });
  });

  it('does not call remove when storage bucket has no files for the user', async () => {
    mockList.mockResolvedValue({ data: [], error: null });
    mockDeleteUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });

    const result = await deleteAccount(mockSupabase, mockUser, { confirmation: 'USUŃ' });

    expect(mockList).toHaveBeenCalledWith('user-uuid-1234');
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockDeleteUser).toHaveBeenCalledWith('user-uuid-1234');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(result).toEqual({ ok: true, data: { success: true } });
  });

  it('does not call remove when storage data is null/undefined', async () => {
    mockList.mockResolvedValue({ data: null, error: null });
    mockDeleteUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });

    const result = await deleteAccount(mockSupabase, mockUser, { confirmation: 'USUŃ' });

    expect(mockList).toHaveBeenCalledWith('user-uuid-1234');
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockDeleteUser).toHaveBeenCalledWith('user-uuid-1234');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(result).toEqual({ ok: true, data: { success: true } });
  });

  it('aborts with unexpected error when storage list fails without calling deleteUser', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockList.mockResolvedValue({
      data: null,
      error: { message: 'Failed to access bucket' },
    });

    const result = await deleteAccount(mockSupabase, mockUser, { confirmation: 'USUŃ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
    }
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('aborts with unexpected error when storage remove fails without calling deleteUser', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockList.mockResolvedValue({
      data: [{ name: 'file1.pdf' }],
      error: null,
    });
    mockRemove.mockResolvedValue({
      error: { message: 'Failed to delete file' },
    });

    const result = await deleteAccount(mockSupabase, mockUser, { confirmation: 'USUŃ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
    }
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns unexpected error when admin.auth.admin.deleteUser fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockList.mockResolvedValue({ data: [], error: null });
    mockDeleteUser.mockResolvedValue({
      error: { message: 'Database connection failed' },
    });

    const result = await deleteAccount(mockSupabase, mockUser, { confirmation: 'USUŃ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
    }
    expect(mockDeleteUser).toHaveBeenCalledWith('user-uuid-1234');
    expect(mockSignOut).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('logs error and still returns ok if signOut throws after user is deleted', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockList.mockResolvedValue({ data: [], error: null });
    mockDeleteUser.mockResolvedValue({ error: null });
    const signOutError = new Error('Network disconnection during signOut');
    mockSignOut.mockRejectedValue(signOutError);

    const result = await deleteAccount(mockSupabase, mockUser, { confirmation: 'USUŃ' });

    expect(mockDeleteUser).toHaveBeenCalledWith('user-uuid-1234');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(consoleSpy).toHaveBeenCalledWith(
      '[deleteAccount] Local signOut failed after user deletion:',
      signOutError
    );
    expect(result).toEqual({ ok: true, data: { success: true } });

    consoleSpy.mockRestore();
  });
});
