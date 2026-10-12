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
import type { Decomposition } from '@/features/ai/schemas';
import { getCurrentUser } from '@/lib/auth';
import { createClient, type ServerSupabase } from '@/lib/supabase/server';

import { POST } from './route';

describe('POST /api/ai/decompose', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const fileId = '11111111-1111-1111-1111-111111111111';
  const validPath = `${userId}/${fileId}.pdf`;
  const typeId = '22222222-2222-4222-8222-222222222222';
  const requestId = '33333333-3333-3333-3333-333333333333';

  const mockUser = {
    id: userId,
    email: 'student@example.com',
  };

  const sampleAiDecomposition: Decomposition = {
    summary: 'Plan przygotowania do sprawdzianu z matematyki',
    sessionMinutes: 45,
    topics: [
      { title: 'Funkcja liniowa', workMinutes: 45 },
      { title: 'Funkcja kwadratowa', workMinutes: 60 },
    ],
    warnings: [],
  };

  const sampleAiUsage = {
    model: 'gemini-2.5-pro',
    inputTokens: 250,
    outputTokens: 120,
  };

  const mockRpc = vi.fn();
  const mockStorageDownload = vi.fn();
  const mockStorageRemove = vi.fn();
  const mockAiRequestsUpdate = vi.fn();
  const mockProfilesSelect = vi.fn();
  const mockTaskTypesSelect = vi.fn();
  let mockSupabase: ServerSupabase;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRpc.mockResolvedValue({ data: requestId, error: null });
    const sampleBlob = new Blob(['pdf-file-bytes'], { type: 'application/pdf' });
    mockStorageDownload.mockResolvedValue({ data: sampleBlob, error: null });
    mockStorageRemove.mockResolvedValue({ data: [{ name: validPath }], error: null });
    mockProfilesSelect.mockResolvedValue({ data: { timezone: 'Europe/Warsaw' }, error: null });
    mockTaskTypesSelect.mockResolvedValue({ data: { name: 'Matematyka' }, error: null });

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
      if (table === 'task_types') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: mockTaskTypesSelect,
              })),
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
      data: sampleAiDecomposition,
      usage: sampleAiUsage,
    });
  });

  it('should return 401 Unauthorized when user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/ai/decompose', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Sprawdzian' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request when request body is not valid JSON', async () => {
    const request = new Request('http://localhost:3000/api/ai/decompose', {
      method: 'POST',
      body: 'invalid-json-text',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Nieprawidłowe dane żądania' });
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request when request body is missing path', async () => {
    const request = new Request('http://localhost:3000/api/ai/decompose', {
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
    const otherUserPath = '99999999-9999-9999-9999-999999999999/11111111-1111-1111-1111-111111111111.pdf';
    const request = new Request('http://localhost:3000/api/ai/decompose', {
      method: 'POST',
      body: JSON.stringify({ path: otherUserPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Nieprawidłowa ścieżka pliku' });
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request when path contains path traversal or invalid extension', async () => {
    const maliciousPath = `${userId}/../11111111-1111-1111-1111-111111111111.exe`;
    const request = new Request('http://localhost:3000/api/ai/decompose', {
      method: 'POST',
      body: JSON.stringify({ path: maliciousPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Nieprawidłowa ścieżka pliku' });
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('should return 429 Too Many Requests when quota is exhausted with P0001 code', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'ai_daily_limit_reached' },
    });

    const request = new Request('http://localhost:3000/api/ai/decompose', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toEqual({ error: 'Limit na dziś wyczerpany' });
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('should return 429 Too Many Requests when quota error message contains ai_daily_limit_reached', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'CUSTOM_ERR', message: 'User error: ai_daily_limit_reached for quota' },
    });

    const request = new Request('http://localhost:3000/api/ai/decompose', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toEqual({ error: 'Limit na dziś wyczerpany' });
  });

  it('should return 500 Internal Server Error when RPC fails with unexpected database error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'Internal DB crash' },
    });

    const request = new Request('http://localhost:3000/api/ai/decompose', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'Błąd rezerwacji limitu AI' });
  });

  it('should return 400 Bad Request, mark request as failed and clean up file when download fails', async () => {
    mockStorageDownload.mockResolvedValue({
      data: null,
      error: new Error('Storage file not found'),
    });

    const request = new Request('http://localhost:3000/api/ai/decompose', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Nie udało się pobrać pliku' });
    expect(mockAiRequestsUpdate).toHaveBeenCalledWith({ status: 'failed', model: null, input_tokens: null, output_tokens: null });
    expect(mockStorageRemove).toHaveBeenCalledWith([validPath]);
  });

  it('should return 422 Unprocessable Entity and mark request failed when Gemini output is blocked', async () => {
    vi.mocked(callGemini).mockResolvedValue({
      ok: false,
      reason: 'blocked',
      usage: { model: 'gemini-2.5-pro', inputTokens: 100, outputTokens: 0 },
    });

    const request = new Request('http://localhost:3000/api/ai/decompose', {
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
      input_tokens: 100,
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

    const request = new Request('http://localhost:3000/api/ai/decompose', {
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

  it('should return 503 Service Unavailable when Gemini is rate_limited', async () => {
    vi.mocked(callGemini).mockResolvedValue({
      ok: false,
      reason: 'rate_limited',
      usage: null,
    });

    const request = new Request('http://localhost:3000/api/ai/decompose', {
      method: 'POST',
      body: JSON.stringify({ path: validPath, description: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ error: AI_FAILURE.rate_limited.message });
    expect(mockStorageRemove).toHaveBeenCalledWith([validPath]);
  });

  it('should return 200 OK with decomposition draft and update ai_requests as succeeded', async () => {
    const request = new Request('http://localhost:3000/api/ai/decompose', {
      method: 'POST',
      body: JSON.stringify({
        path: validPath,
        typeId,
        deadline: '2026-10-20T14:00',
        description: 'Przygotuj plan nauki',
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      summary: 'Plan przygotowania do sprawdzianu z matematyki',
      sessionMinutes: 45,
      estimateMinutes: 105,
      topics: [
        { title: 'Funkcja liniowa', workMinutes: 45 },
        { title: 'Funkcja kwadratowa', workMinutes: 60 },
      ],
      warnings: [],
    });

    expect(mockAiRequestsUpdate).toHaveBeenCalledWith({
      status: 'succeeded',
      model: 'gemini-2.5-pro',
      input_tokens: 250,
      output_tokens: 120,
    });
    expect(mockStorageRemove).toHaveBeenCalledWith([validPath]);
  });

  it('should fallback to default timezone when profile has no timezone and handle null typeId', async () => {
    mockProfilesSelect.mockResolvedValue({ data: { timezone: null }, error: null });

    const request = new Request('http://localhost:3000/api/ai/decompose', {
      method: 'POST',
      body: JSON.stringify({
        path: validPath,
        description: 'Bez typu',
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockTaskTypesSelect).not.toHaveBeenCalled();
    expect(mockStorageRemove).toHaveBeenCalledWith([validPath]);
  });
});
