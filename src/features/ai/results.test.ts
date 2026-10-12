import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { parseModelOutput, reasonFromError, reasonFromInteraction } from '@/features/ai/results';

describe('reasonFromError', () => {
  it('should say rate_limited when the API answers 429', () => {
    // Arrange
    const error = Object.assign(new Error('429 Resource exhausted'), { status: 429 });

    // Act
    const reason = reasonFromError(error);

    // Assert
    expect(reason).toBe('rate_limited');
  });

  it('should say payment_required when the API answers 402', () => {
    expect(reasonFromError({ status: 402 })).toBe('payment_required');
  });

  it('should say unavailable when the API answers another status', () => {
    expect(reasonFromError({ status: 500 })).toBe('unavailable');
    expect(reasonFromError({ status: 400 })).toBe('unavailable');
  });

  it('should say unavailable when the error has no HTTP status', () => {
    expect(reasonFromError(new Error('fetch failed'))).toBe('unavailable');
    expect(reasonFromError({ status: '429' })).toBe('unavailable');
    expect(reasonFromError(null)).toBe('unavailable');
  });
});

describe('reasonFromInteraction', () => {
  it('should give no reason when the interaction completed with valid text', () => {
    expect(reasonFromInteraction('completed', '{"events":[]}')).toBeNull();
  });

  it('should say blocked when the interaction is incomplete', () => {
    expect(reasonFromInteraction('incomplete', '{"events":[')).toBe('blocked');
  });

  it('should say blocked when a completed interaction has empty or whitespace text', () => {
    expect(reasonFromInteraction('completed', undefined)).toBe('blocked');
    expect(reasonFromInteraction('completed', '')).toBe('blocked');
    expect(reasonFromInteraction('completed', '  ')).toBe('blocked');
    expect(reasonFromInteraction('completed', '\n\t ')).toBe('blocked');
  });

  it('should say unavailable when the interaction failed or is in a non-completed state', () => {
    expect(reasonFromInteraction('failed', undefined)).toBe('unavailable');
    expect(reasonFromInteraction('budget_exceeded', undefined)).toBe('unavailable');
    expect(reasonFromInteraction('cancelled', undefined)).toBe('unavailable');
    expect(reasonFromInteraction('requires_action', undefined)).toBe('unavailable');
    expect(reasonFromInteraction('in_progress', undefined)).toBe('unavailable');
    expect(reasonFromInteraction('queued', undefined)).toBe('unavailable');
  });
});

describe('parseModelOutput', () => {
  const Schema = z.object({ minutes: z.number().int().min(10) });

  it('should return the data when the JSON matches the schema', () => {
    expect(parseModelOutput('{"minutes": 45}', Schema)).toEqual({ minutes: 45 });
  });

  it('should return null when the JSON breaks a rule of the schema', () => {
    expect(parseModelOutput('{"minutes": 5}', Schema)).toBeNull();
    expect(parseModelOutput('{"minutes": "45"}', Schema)).toBeNull();
  });

  it('should return null when the text is not JSON', () => {
    expect(parseModelOutput('Oto plan: {"minutes": 45}', Schema)).toBeNull();
  });

  it('should parse JSON when wrapped in a markdown code block', () => {
    const wrappedInJsonBlock = '```json\n{"minutes": 45}\n```';
    const wrappedInPlainBlock = '```\n{"minutes": 45}\n```';

    expect(parseModelOutput(wrappedInJsonBlock, Schema)).toEqual({ minutes: 45 });
    expect(parseModelOutput(wrappedInPlainBlock, Schema)).toEqual({ minutes: 45 });
  });
});
