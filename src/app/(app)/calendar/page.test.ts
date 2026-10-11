import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import * as React from 'react';

const mockCalendarPageContent = vi.fn();
vi.mock('@/features/calendar/components/calendar-page-content', () => ({
  CalendarPageContent: (props: unknown) => {
    mockCalendarPageContent(props);
    return React.createElement('div', { 'data-testid': 'mock-calendar-page-content' });
  },
}));

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/features/profile/queries', () => ({
  getProfile: vi.fn(),
}));

vi.mock('@/features/task-types/queries', () => ({
  listTaskTypes: vi.fn(),
}));

vi.mock('@/features/tasks/queries', () => ({
  listBacklog: vi.fn(),
}));

vi.mock('@/features/blocks/queries', () => ({
  listUnclosedBlocks: vi.fn(),
}));

import { renderToStaticMarkup } from 'react-dom/server';

import type { UnclosedBlockItem } from '@/features/blocks/types';
import { listUnclosedBlocks } from '@/features/blocks/queries';
import type { ProfileRow } from '@/features/profile/queries';
import { getProfile } from '@/features/profile/queries';
import type { TaskTypeRow } from '@/features/task-types';
import { listTaskTypes } from '@/features/task-types/queries';
import { listBacklog } from '@/features/tasks/queries';
import type { BacklogTaskItem } from '@/features/tasks/types';
import { requireUser } from '@/lib/auth';
import type { ServerSupabase } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';

import CalendarPage, { metadata } from './page';

function createMockProfile(overrides?: Partial<ProfileRow>): ProfileRow {
  return {
    id: 'user-test-123',
    display_name: 'Tester',
    timezone: 'Europe/Berlin',
    day_start: '09:30:00',
    day_end: '18:00:00',
    daily_energy_limit: 10,
    reflection_level: 'basic',
    onboarded_at: '2026-10-01T08:00:00.000Z',
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

function createMockTaskTypes(): readonly TaskTypeRow[] {
  return [
    {
      id: 'type-1',
      user_id: 'user-test-123',
      name: 'Matematyka',
      color: '#3b82f6',
      energy: 3,
      is_rest: false,
      is_one_off: false,
      archived_at: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
    },
  ];
}

function createMockBacklogTasks(): readonly BacklogTaskItem[] {
  return [
    {
      id: 'task-1',
      typeId: 'type-1',
      typeName: 'Matematyka',
      typeColor: '#3b82f6',
      typeEnergy: 3,
      isOneOff: false,
      priority: 1,
      fixation: 'flexible',
      notes: 'Zadania ze strony 42',
      estimateMinutes: 90,
      sessionMinutes: 45,
      deadline: '2026-10-15T12:00:00.000Z',
      createdAt: '2026-10-02T10:00:00.000Z',
      typePace: 1.0,
    },
  ];
}

function createMockUnclosedBlocks(): readonly UnclosedBlockItem[] {
  return [
    {
      id: 'block-1',
      taskId: 'task-1',
      startsAt: '2026-10-11T08:00:00.000Z',
      endsAt: '2026-10-11T09:30:00.000Z',
      workMinutes: 90,
      typeName: 'Matematyka',
      typeColor: '#3b82f6',
      typeEnergy: 3,
      notes: 'Algebra',
    },
  ];
}

const mockSupabase = { from: vi.fn() } as unknown as ServerSupabase;
const mockUser = { id: 'user-test-123', email: 'tester@example.com' };

function setupDefaultMocks(): void {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({ user: mockUser, supabase: mockSupabase });
  vi.mocked(createClient).mockResolvedValue(mockSupabase);
  vi.mocked(getProfile).mockResolvedValue(createMockProfile());
  vi.mocked(listTaskTypes).mockResolvedValue([...createMockTaskTypes()]);
  vi.mocked(listBacklog).mockResolvedValue([...createMockBacklogTasks()]);
  vi.mocked(listUnclosedBlocks).mockResolvedValue([...createMockUnclosedBlocks()]);
}

describe('CalendarPage metadata', () => {
  it('should export the expected page title', () => {
    expect(metadata).toEqual({
      title: 'Kalendarz',
    });
  });
});

describe('CalendarPage auth and data fetching', () => {
  beforeEach(setupDefaultMocks);

  it('should authenticate user and fetch all data in parallel with correct parameters', async () => {
    const pageJsx = await CalendarPage();
    const html = renderToStaticMarkup(pageJsx);

    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(getProfile).toHaveBeenCalledWith(mockSupabase, 'user-test-123');
    expect(listTaskTypes).toHaveBeenCalledWith(mockSupabase, 'user-test-123');
    expect(listBacklog).toHaveBeenCalledWith(mockSupabase, 'user-test-123');
    expect(listUnclosedBlocks).toHaveBeenCalledWith(mockSupabase, 'user-test-123');

    expect(mockCalendarPageContent).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: expect.arrayContaining([expect.objectContaining({ id: 'task-1' })]),
        taskTypes: expect.arrayContaining([expect.objectContaining({ id: 'type-1' })]),
        unclosedBlocks: expect.arrayContaining([expect.objectContaining({ id: 'block-1' })]),
        timeZone: 'Europe/Berlin',
        workStart: '09:30',
      }),
    );

    expect(html).toContain('container mx-auto px-2 sm:px-4 py-4 sm:py-6');
    expect(html).toContain('data-testid="mock-calendar-page-content"');
  });

  it('should propagate authentication redirection or error without querying data', async () => {
    const authError = new Error('NEXT_REDIRECT: /login');
    vi.mocked(requireUser).mockRejectedValueOnce(authError);

    await expect(CalendarPage()).rejects.toThrow('NEXT_REDIRECT: /login');

    expect(createClient).not.toHaveBeenCalled();
    expect(getProfile).not.toHaveBeenCalled();
    expect(listTaskTypes).not.toHaveBeenCalled();
    expect(listBacklog).not.toHaveBeenCalled();
    expect(listUnclosedBlocks).not.toHaveBeenCalled();
  });

  it('should propagate query errors if one of the queries rejects', async () => {
    vi.mocked(listBacklog).mockRejectedValueOnce(new Error('Database query timeout'));

    await expect(CalendarPage()).rejects.toThrow('Database query timeout');
  });
});

describe('CalendarPage profile fallbacks', () => {
  beforeEach(setupDefaultMocks);

  it('should fall back to Europe/Warsaw and 08:00 when profile is null', async () => {
    vi.mocked(getProfile).mockResolvedValueOnce(null);

    renderToStaticMarkup(await CalendarPage());

    expect(mockCalendarPageContent).toHaveBeenCalledWith(
      expect.objectContaining({
        timeZone: 'Europe/Warsaw',
        workStart: '08:00',
      }),
    );
  });

  it('should fall back to defaults when profile has empty/invalid fields', async () => {
    vi.mocked(getProfile).mockResolvedValueOnce(
      createMockProfile({
        timezone: undefined,
        day_start: '',
      }),
    );

    renderToStaticMarkup(await CalendarPage());

    expect(mockCalendarPageContent).toHaveBeenCalledWith(
      expect.objectContaining({
        timeZone: 'Europe/Warsaw',
        workStart: '08:00',
      }),
    );
  });

  it('should fall back to 08:00 when day_start is shorter than 5 characters', async () => {
    vi.mocked(getProfile).mockResolvedValueOnce(
      createMockProfile({
        day_start: '07:',
      }),
    );

    renderToStaticMarkup(await CalendarPage());

    expect(mockCalendarPageContent).toHaveBeenCalledWith(
      expect.objectContaining({
        workStart: '08:00',
      }),
    );
  });

  it('should normalize workStart by slicing first 5 characters when day_start has seconds', async () => {
    vi.mocked(getProfile).mockResolvedValueOnce(
      createMockProfile({
        day_start: '07:45:00',
      }),
    );

    renderToStaticMarkup(await CalendarPage());

    expect(mockCalendarPageContent).toHaveBeenCalledWith(
      expect.objectContaining({
        workStart: '07:45',
      }),
    );
  });
});
