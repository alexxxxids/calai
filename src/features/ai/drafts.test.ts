import { describe, expect, it } from 'vitest';
import {
  estimateFromTopics,
  nearestMonday,
  schoolYearEnd,
  toDecompositionDraft,
  topicsToNotes,
} from '@/features/ai/drafts';

describe('estimateFromTopics', () => {
  it('should add the minutes of all topics when the sum is on the 5-minute grid', () => {
    // Arrange
    const topics = [
      { title: 'Funkcja kwadratowa', workMinutes: 45 },
      { title: 'Wzory Viète’a', workMinutes: 30 },
    ];

    // Act
    const estimate = estimateFromTopics(topics);

    // Assert
    expect(estimate).toBe(75);
  });

  it('should round the sum to 5 minutes when it is off the grid', () => {
    expect(estimateFromTopics([{ title: 'A', workMinutes: 12 }])).toBe(10);
    expect(estimateFromTopics([{ title: 'A', workMinutes: 13 }])).toBe(15);
  });
});

describe('toDecompositionDraft', () => {
  it('should round the session length down to the grid and add the estimate', () => {
    // Arrange: the model suggested 50-minute sessions.
    const output = {
      summary: 'Sprawdzian z funkcji',
      sessionMinutes: 50,
      topics: [{ title: 'Wykres', workMinutes: 40 }],
      warnings: [],
    };

    // Act
    const draft = toDecompositionDraft(output);

    // Assert
    expect(draft.sessionMinutes).toBe(45);
    expect(draft.estimateMinutes).toBe(40);
  });

  it('should add a warning when the estimate exceeds MAX_ESTIMATE_MINUTES (100 hours)', () => {
    // Arrange: 11 topics of 600 minutes = 6600 minutes (> 6000)
    const topics = Array.from({ length: 11 }, () => ({ title: 'Temat', workMinutes: 600 }));
    const output = {
      summary: 'Długi projekt',
      sessionMinutes: 60,
      topics,
      warnings: ['Oryginalne ostrzeżenie'],
    };

    // Act
    const draft = toDecompositionDraft(output);

    // Assert
    expect(draft.estimateMinutes).toBe(6600);
    expect(draft.warnings).toContain(
      'Łączny czas tematów przekracza 100 godzin. Skróć lub usuń część tematów przed zapisaniem.',
    );
  });
});

describe('topicsToNotes', () => {
  it('should list the topics with numbers and minutes', () => {
    const notes = topicsToNotes([
      { title: 'Wykres', workMinutes: 40 },
      { title: 'Miejsca zerowe', workMinutes: 25 },
    ]);

    expect(notes).toBe('Tematy:\n1. Wykres — 40 min\n2. Miejsca zerowe — 25 min');
  });

  it('should cut whole lines and end with an ellipsis when the list is longer than 2000 characters', () => {
    // Arrange: 40 topics of 120 characters are about 5000 characters.
    const topics = Array.from({ length: 40 }, () => ({ title: 'x'.repeat(120), workMinutes: 30 }));

    // Act
    const notes = topicsToNotes(topics);

    // Assert
    expect(notes.length).toBeLessThanOrEqual(2000);
    expect(notes.endsWith('\n…')).toBe(true);
    expect(notes.split('\n').slice(1, -1).every((line) => line.endsWith('— 30 min'))).toBe(true);
  });
});

describe('nearestMonday', () => {
  it('should keep the date when it is a Monday', () => {
    expect(nearestMonday('2026-09-28')).toBe('2026-09-28');
  });

  it('should give the next Monday when the date is later in the week', () => {
    expect(nearestMonday('2026-09-29')).toBe('2026-10-05');
    expect(nearestMonday('2026-10-04')).toBe('2026-10-05');
  });

  it('should cross the year when the next Monday is in January', () => {
    expect(nearestMonday('2026-12-30')).toBe('2027-01-04');
  });
});

describe('schoolYearEnd', () => {
  it('should give the first Friday after 20 June of the next year when the date is in autumn', () => {
    expect(schoolYearEnd('2026-09-28')).toBe('2027-06-25');
  });

  it('should give this June when the date is in spring', () => {
    expect(schoolYearEnd('2027-03-01')).toBe('2027-06-25');
  });

  it('should keep the last day of classes itself in that school year', () => {
    expect(schoolYearEnd('2027-06-25')).toBe('2027-06-25');
  });

  it('should move to the next school year when classes have already ended', () => {
    expect(schoolYearEnd('2027-06-26')).toBe('2028-06-23');
  });

  it('should skip 20 June when it is itself a Friday', () => {
    // 20 June 2025 was a Friday; classes ended a week later.
    expect(schoolYearEnd('2025-03-01')).toBe('2025-06-27');
  });
});
