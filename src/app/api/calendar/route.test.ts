import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/features/calendar', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getCalendarItems: vi.fn(),
  };
});

import { getCurrentUser } from '@/lib/auth';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';
import { getCalendarItems, type CalendarEventItem } from '@/features/calendar';

import { GET } from './route';

describe('GET /api/calendar', () => {
  const mockSupabase = {} as ServerSupabase;
  const mockUser = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'user@example.com',
  };

  const sampleCalendarItems: CalendarEventItem[] = [
    {
      id: 'block-1',
      title: 'Nauka',
      start: '2026-10-06T10:00:00.000Z',
      end: '2026-10-06T11:00:00.000Z',
      color: '#3b82f6',
      editable: true,
      extendedProps: {
        kind: 'block',
        status: 'planned',
        pinned: true,
        taskId: 'task-1',
        energy: 3,
        typeId: 'type-1',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
  });

  it('should return 401 Unauthorized when user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const request = new Request(
      'http://localhost:3000/api/calendar?start=2026-10-05T00:00:00.000Z&end=2026-10-12T00:00:00.000Z',
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(getCalendarItems).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request when start or end parameter is missing', async () => {
    const requestWithoutParams = new Request('http://localhost:3000/api/calendar');
    const response = await GET(requestWithoutParams);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Nieprawidłowy zakres dat');
    expect(body.details).toBeDefined();
    expect(getCalendarItems).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request when date format is not ISO', async () => {
    const request = new Request(
      'http://localhost:3000/api/calendar?start=2026-10-05&end=invalid-date',
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Nieprawidłowy zakres dat');
    expect(body.details).toBeDefined();
    expect(getCalendarItems).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request when end is before or equal to start', async () => {
    const request = new Request(
      'http://localhost:3000/api/calendar?start=2026-10-12T00:00:00.000Z&end=2026-10-05T00:00:00.000Z',
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Nieprawidłowy zakres dat');
    expect(body.details.fieldErrors.end).toContain(
      'Koniec zakresu musi być późniejszy niż początek',
    );
    expect(getCalendarItems).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request when range exceeds 62 days', async () => {
    const request = new Request(
      'http://localhost:3000/api/calendar?start=2026-10-01T00:00:00.000Z&end=2026-12-05T00:00:00.000Z',
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Nieprawidłowy zakres dat');
    expect(body.details.fieldErrors.end).toContain('Zakres nie może przekraczać 62 dni');
    expect(getCalendarItems).not.toHaveBeenCalled();
  });

  it('should return 200 OK with calendar items when request is valid and user is authenticated', async () => {
    vi.mocked(getCalendarItems).mockResolvedValue(sampleCalendarItems);

    const request = new Request(
      'http://localhost:3000/api/calendar?start=2026-10-05T00:00:00.000Z&end=2026-10-12T00:00:00.000Z',
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(sampleCalendarItems);
    expect(getCalendarItems).toHaveBeenCalledWith(mockSupabase, mockUser.id, {
      start: '2026-10-05T00:00:00.000Z',
      end: '2026-10-12T00:00:00.000Z',
    });
  });

  it('should return 500 Internal Server Error with sanitized error message when getCalendarItems throws an Error', async () => {
    vi.mocked(getCalendarItems).mockRejectedValue(
      new Error('database connection timeout: server closed socket unexpectedly'),
    );

    const request = new Request(
      'http://localhost:3000/api/calendar?start=2026-10-05T00:00:00.000Z&end=2026-10-12T00:00:00.000Z',
    );
    const response = await GET(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'Błąd pobierania wydarzeń kalendarza' });
  });

  it('should return 500 Internal Server Error with default message when non-Error thrown', async () => {
    vi.mocked(getCalendarItems).mockRejectedValue('Nieznany błąd');

    const request = new Request(
      'http://localhost:3000/api/calendar?start=2026-10-05T00:00:00.000Z&end=2026-10-12T00:00:00.000Z',
    );
    const response = await GET(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'Błąd pobierania wydarzeń kalendarza' });
  });
});
