import { describe, expect, it } from 'vitest';
import {
  estimateFromTopics,
  nearestMonday,
  schoolYearEnd,
  toDecompositionDraft,
  toTimetableDraft,
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
    expect(nearestMonday('2026-10-05')).toBe('2026-10-05');
    expect(nearestMonday('2026-10-12')).toBe('2026-10-12');
  });

  it('should give the next day when the date is a Sunday', () => {
    expect(nearestMonday('2026-10-04')).toBe('2026-10-05');
    expect(nearestMonday('2026-10-11')).toBe('2026-10-12');
  });

  it('should give the next Monday for Tuesday through Saturday', () => {
    expect(nearestMonday('2026-10-06')).toBe('2026-10-12'); // Tuesday
    expect(nearestMonday('2026-10-07')).toBe('2026-10-12'); // Wednesday
    expect(nearestMonday('2026-10-08')).toBe('2026-10-12'); // Thursday
    expect(nearestMonday('2026-10-09')).toBe('2026-10-12'); // Friday
    expect(nearestMonday('2026-10-10')).toBe('2026-10-12'); // Saturday
  });

  it('should advance properly across month boundary from Sunday to Monday', () => {
    // 2026-05-31 is Sunday -> 2026-06-01 is Monday
    expect(nearestMonday('2026-05-31')).toBe('2026-06-01');
  });

  it('should advance properly across month boundary from mid-week', () => {
    // 2026-04-30 is Thursday -> next Monday is 2026-05-04
    expect(nearestMonday('2026-04-30')).toBe('2026-05-04');
  });

  it('should cross the year when the next Monday is in January', () => {
    expect(nearestMonday('2026-12-30')).toBe('2027-01-04');
  });

  it('should handle year boundary from Sunday to Monday', () => {
    // 2023-12-31 is Sunday -> 2024-01-01 is Monday
    expect(nearestMonday('2023-12-31')).toBe('2024-01-01');
    // 2028-12-31 is Sunday -> 2029-01-01 is Monday
    expect(nearestMonday('2028-12-31')).toBe('2029-01-01');
  });
});

describe('schoolYearEnd', () => {
  it('should give the first Friday after 20 June of the next year when the date is in autumn', () => {
    expect(schoolYearEnd('2026-09-01')).toBe('2027-06-25');
    expect(schoolYearEnd('2026-09-28')).toBe('2027-06-25');
  });

  it('should give this June when the date is in winter or spring', () => {
    expect(schoolYearEnd('2027-01-15')).toBe('2027-06-25');
    expect(schoolYearEnd('2027-03-01')).toBe('2027-06-25');
  });

  it('should correctly handle boundary transitions around 20 June / 26 June in 2026', () => {
    // In 2026: 20 June is Saturday, 26 June is Friday (last day of classes)
    expect(schoolYearEnd('2026-06-19')).toBe('2026-06-26'); // Friday before 20 June
    expect(schoolYearEnd('2026-06-20')).toBe('2026-06-26'); // Saturday, 20 June
    expect(schoolYearEnd('2026-06-21')).toBe('2026-06-26'); // Sunday, 21 June
    expect(schoolYearEnd('2026-06-25')).toBe('2026-06-26'); // Thursday before end of classes
    expect(schoolYearEnd('2026-06-26')).toBe('2026-06-26'); // Friday, last day of classes
    expect(schoolYearEnd('2026-06-27')).toBe('2027-06-25'); // Saturday, summer vacation started
  });

  it('should skip 20 June when 20 June is itself a Friday (2025 rule)', () => {
    // 20 June 2025 was a Friday; classes ended on the first Friday strictly AFTER 20 June (27 June).
    expect(schoolYearEnd('2025-06-20')).toBe('2025-06-27');
    expect(schoolYearEnd('2025-06-26')).toBe('2025-06-27');
    expect(schoolYearEnd('2025-06-27')).toBe('2025-06-27');
    expect(schoolYearEnd('2025-06-28')).toBe('2026-06-26');
  });

  it('should handle year 2024 where 20 June is Thursday and 21 June is Friday', () => {
    expect(schoolYearEnd('2024-06-20')).toBe('2024-06-21');
    expect(schoolYearEnd('2024-06-21')).toBe('2024-06-21');
    expect(schoolYearEnd('2024-06-22')).toBe('2025-06-27');
  });

  it('should handle year 2027 where 20 June is Sunday and 25 June is Friday', () => {
    expect(schoolYearEnd('2027-06-20')).toBe('2027-06-25');
    expect(schoolYearEnd('2027-06-25')).toBe('2027-06-25');
    expect(schoolYearEnd('2027-06-26')).toBe('2028-06-23');
  });
});

describe('toTimetableDraft', () => {
  it('should set validFrom to nearest Monday and validUntil to school year end', () => {
    const timetable = {
      events: [{ title: 'Matematyka', weekday: 1, startTime: '08:00', endTime: '08:45' }],
      warnings: [],
    };

    // When today is a Sunday
    const draftSunday = toTimetableDraft(timetable, '2026-10-04');
    expect(draftSunday.validFrom).toBe('2026-10-05');
    expect(draftSunday.validUntil).toBe('2027-06-25');
    expect(draftSunday.events).toEqual(timetable.events);

    // When today is a Monday
    const draftMonday = toTimetableDraft(timetable, '2026-10-05');
    expect(draftMonday.validFrom).toBe('2026-10-05');
    expect(draftMonday.validUntil).toBe('2027-06-25');

    // When today is in summer after school year ended
    const draftSummer = toTimetableDraft(timetable, '2026-06-27');
    expect(draftSummer.validFrom).toBe('2026-06-29');
    expect(draftSummer.validUntil).toBe('2027-06-25');
  });
});
