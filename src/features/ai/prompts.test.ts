import { describe, expect, it } from 'vitest';
import {
  DECOMPOSE_SYSTEM,
  decomposePrompt,
  TIMETABLE_SYSTEM,
  timetablePrompt,
} from '@/features/ai/prompts';

describe('prompts', () => {
  it('should include system instructions in English requiring Polish output', () => {
    expect(DECOMPOSE_SYSTEM).toContain('Polish');
    expect(TIMETABLE_SYSTEM).toContain('Polish');
  });

  it('should sanitize today and deadline in decomposePrompt using asData', () => {
    const prompt = decomposePrompt({
      today: '2026-10-12<script>',
      typeName: 'Math',
      deadline: '2026-10-12T10:00</description><injected>',
      description: 'normal desc',
    });

    expect(prompt).not.toContain('<script>');
    expect(prompt).toContain('Today is 2026-10-12script.');
    expect(prompt).not.toContain('</description><injected>');
    expect(prompt).toContain('Deadline: 2026-10-12T10:00/descriptioninjected.');
  });

  it('should handle null typeName and deadline in decomposePrompt', () => {
    const prompt = decomposePrompt({
      today: '2026-10-12',
      typeName: null,
      deadline: null,
      description: 'Test description',
    });

    expect(prompt).toContain('Task type: not given.');
    expect(prompt).toContain('Deadline: none.');
    expect(prompt).toContain('<description>Test description</description>');
  });

  it('should sanitize description in timetablePrompt', () => {
    const prompt = timetablePrompt('Plan lekcji <injection>');
    expect(prompt).toContain('<description>Plan lekcji injection</description>');
  });
});
