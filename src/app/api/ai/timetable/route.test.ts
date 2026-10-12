import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/features/ai/gateway', () => ({
  callGemini: vi.fn(),
}));

import { callGemini } from '@/features/ai/gateway';
import { AI_FAILURE } from '@/features/ai/results';
import type { Timetable } from '@/features/ai/schemas';
import { getCurrentUser } from '@/lib/auth';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';

import { POST } from './route';

describe('POST /api/ai/timetable', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const fileId = '11111111-1111-1111-1111-111111111111';
  const validPath = `${userId}/${fileId}.png`;
  const requestId = '33333333-3333-3333-3333-333333333333';

  const mockUser = {
    id: userId,
    email: 'student@example.com',
  };

  const sampleAiTimetable: Timetable = {
    events: [
      {
        title: 'Język polski',
        weekday: 1,
        startTime: '08:00',
        endTime: '08:45',
      },
      {
        title: 'Matematyka',
        weekday: 1,
        startTime: '08:55',
        endTime: '09:40',
      },
    ],
    warnings: [],
  };

  const sampleAiUsage = {
    model: 'gemini-2.5-pro',
    inputTokens: 300,
    outputTokens: 150,
  };

  const mockRpc = vi.fn();
  const mockStorageDownload = vi.fn();
  const mockStorageRemove = vi.fn();
  const mockAiRequestsUpdate = vi.fn();
  const mockProfilesSelect = vi.fn();
  let mockSupabase: ServerSupabase;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRpc.mockResolvedValue({ data: requestId, error: null });
    const sampleBlob = new Blob(['png-file-bytes'], { type: 'image/png' });
    mockStorageDownload.mockResolvedValue({ data: sampleBlob, error: null });
    mockStorageRemove.mockResolvedValue({ data: [{ name: validPath }], error: null });
    mockProfilesSelect.mockResolvedValue({ data: { timezone: 'Europe/Warsaw' }, error: null });

    const mockFrom = vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: mockProfilesSelect,
            })),
          })),
        };
      }
      if (table === 'ai_requests') {
        return {
          update: vi.fn((updateData: unknown) => {
            mockAiRequestsUpdate(updateData);
            return {
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const mockStorage = {
      from: vi.fn((bucket: string) => {
        if (bucket === 'ai-uploads') {
          return {
            download: mockStorageDownload,
            remove: mockStorageRemove,
          };
        }
        throw new Error(`Unexpected bucket: ${bucket}`);
      }),
    };

    mockSupabase = {
      rpc: mockRpc,
      from: mockFrom,
      storage: mockStorage,
    } as unknown as ServerSupabase;

    vi.mocked(createClient).mockResolvedValue(mockSupabase);
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(callGemini).mockResolvedValue({
      ok: true,
      data: sampleAiTimetable,
      usage: sampleAiUsage,
    });
  });

  it('should return 401 Unauthorized when user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Plan lekcji' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request when request body is not valid JSON', async () => {
    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: 'invalid-json',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Nieprawidłowe dane żądania' });
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request when request body is missing path', async () => {
    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: JSON.stringify({ description: 'Brak path' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Nieprawidłowe dane żądania' });
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request when path belongs to another user', async () => {
    const otherUserPath = '99999999-9999-9999-9999-999999999999/11111111-1111-1111-1111-111111111111.png';
    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: JSON.stringify({ path: otherUserPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Nieprawidłowa ścieżka pliku' });
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request when path has invalid extension', async () => {
    const maliciousPath = `${userId}/11111111-1111-1111-1111-111111111111.zip`;
    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: JSON.stringify({ path: maliciousPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Nieprawidłowa ścieżka pliku' });
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('should return 429 Too Many Requests when daily quota is exhausted (P0001)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'ai_daily_limit_reached' },
    });

    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toEqual({ error: 'Limit na dziś wyczerpany' });
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('should return 429 Too Many Requests when error message contains ai_daily_limit_reached', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'ERR_LIMIT', message: 'daily: ai_daily_limit_reached' },
    });

    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toEqual({ error: 'Limit na dziś wyczerpany' });
  });

  it('should return 500 Internal Server Error when RPC returns unexpected error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '50000', message: 'Database error' },
    });

    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'Błąd rezerwacji limitu AI' });
  });

  it('should return 400 Bad Request, mark request as failed and remove file when download fails', async () => {
    mockStorageDownload.mockResolvedValue({
      data: null,
      error: new Error('File download failed'),
    });

    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Nie udało się pobrać pliku' });
    expect(mockAiRequestsUpdate).toHaveBeenCalledWith({
      status: 'failed',
      model: null,
      input_tokens: null,
      output_tokens: null,
    });
    expect(mockStorageRemove).toHaveBeenCalledWith([validPath]);
  });

  it('should return 422 Unprocessable Entity and mark request failed when Gemini is blocked', async () => {
    vi.mocked(callGemini).mockResolvedValue({
      ok: false,
      reason: 'blocked',
      usage: { model: 'gemini-2.5-pro', inputTokens: 50, outputTokens: 0 },
    });

    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toEqual({ error: AI_FAILURE.blocked.message });
    expect(mockAiRequestsUpdate).toHaveBeenCalledWith({
      status: 'failed',
      model: 'gemini-2.5-pro',
      input_tokens: 50,
      output_tokens: 0,
    });
    expect(mockStorageRemove).toHaveBeenCalledWith([validPath]);
  });

  it('should return 502 Bad Gateway when Gemini returns invalid_output', async () => {
    vi.mocked(callGemini).mockResolvedValue({
      ok: false,
      reason: 'invalid_output',
      usage: null,
    });

    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({ error: AI_FAILURE.invalid_output.message });
    expect(mockAiRequestsUpdate).toHaveBeenCalledWith({
      status: 'failed',
      model: null,
      input_tokens: null,
      output_tokens: null,
    });
    expect(mockStorageRemove).toHaveBeenCalledWith([validPath]);
  });

  it('should return 503 Service Unavailable when Gemini is unavailable', async () => {
    vi.mocked(callGemini).mockResolvedValue({
      ok: false,
      reason: 'rate_limited',
      usage: null,
    });

    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ error: AI_FAILURE.rate_limited.message });
    expect(mockStorageRemove).toHaveBeenCalledWith([validPath]);
  });

  it('should return 200 OK with timetable draft and update ai_requests as succeeded', async () => {
    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: JSON.stringify({
        path: validPath,
        description: 'Plan lekcji klasa 3',
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      events: sampleAiTimetable.events,
      warnings: [],
      validFrom: expect.any(String),
      validUntil: expect.any(String),
    });

    expect(mockAiRequestsUpdate).toHaveBeenCalledWith({
      status: 'succeeded',
      model: 'gemini-2.5-pro',
      input_tokens: 300,
      output_tokens: 150,
    });
    expect(mockStorageRemove).toHaveBeenCalledWith([validPath]);
  });

  it('should fallback to default timezone when profile timezone is null', async () => {
    mockProfilesSelect.mockResolvedValue({ data: { timezone: null }, error: null });

    const request = new Request('http://localhost:3000/api/ai/timetable', {
      method: 'POST',
      body: JSON.stringify({
        path: validPath,
        description: 'Test',
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockStorageRemove).toHaveBeenCalledWith([validPath]);
  });
});
