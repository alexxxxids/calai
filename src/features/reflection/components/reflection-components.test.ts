import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../actions', () => ({
  saveWeeklyReflection: vi.fn(),
  saveMonthlyReflection: vi.fn(),
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RatingRadioGroup } from './rating-radio-group';
import { ReflectionLocked } from './reflection-locked';
import { MonthlyTypeStats } from './monthly-type-stats';
import { WeeklyReflectionForm } from './weekly-reflection-form';
import { MonthlyReflectionForm } from './monthly-reflection-form';
import { ReflectionView } from './reflection-view';
import type { DisplayTypeStat } from '../rules';
import type { MonthlyReflectionState, ReflectionState, WeeklyReflectionState } from '../types';

describe('features/reflection/components/rating-radio-group', () => {
  it('should render label, description and all rating options from 1 to 5', () => {
    const html = renderToStaticMarkup(
      React.createElement(RatingRadioGroup, {
        label: 'Zmęczenie',
        description: 'Jak oceniasz poziom zmęczenia?',
        name: 'fatigue',
        value: 3,
        minLabel: 'Wypoczęty',
        maxLabel: 'Wyczerpany',
        onChange: () => {},
      }),
    );

    expect(html).toContain('Zmęczenie');
    expect(html).toContain('Jak oceniasz poziom zmęczenia?');
    expect(html).toContain('1: Wypoczęty');
    expect(html).toContain('5: Wyczerpany');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-checked="true"');
  });
});

describe('features/reflection/components/reflection-locked', () => {
  it('should render title, description and link to settings', () => {
    const html = renderToStaticMarkup(
      React.createElement(ReflectionLocked, {
        title: 'Refleksja zablokowana',
        description: 'Ten moduł wymaga poziomu analitycznego.',
      }),
    );

    expect(html).toContain('Refleksja zablokowana');
    expect(html).toContain('Ten moduł wymaga poziomu analitycznego.');
    expect(html).toContain('href="/settings"');
  });
});

describe('features/reflection/components/monthly-type-stats', () => {
  it('should render empty state message when no stats are provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(MonthlyTypeStats, {
        stats: [],
        monthLabel: 'Październik 2026',
      }),
    );

    expect(html).toContain('Statystyka typów zadań (Październik 2026)');
    expect(html).toContain('Brak zrealizowanych zadań w tym miesiącu.');
  });

  it('should render stats with formatted time and completion counts (FR-21)', () => {
    const stats: readonly DisplayTypeStat[] = [
      {
        typeId: 't-1',
        typeName: 'Nauka',
        color: '#3b82f6',
        isOneOff: false,
        plannedMinutes: 120,
        actualMinutes: 90,
        doneBlocks: 2,
        missedBlocks: 1,
      },
      {
        typeId: 'one-off-aggregate',
        typeName: 'Jednorazowe',
        color: '#888888',
        isOneOff: true,
        plannedMinutes: 60,
        actualMinutes: 60,
        doneBlocks: 1,
        missedBlocks: 0,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(MonthlyTypeStats, {
        stats,
        monthLabel: 'Październik 2026',
      }),
    );

    expect(html).toContain('Nauka');
    expect(html).toContain('Jednorazowe');
    expect(html).toContain('(jednorazowe)');
    expect(html).toContain('1 h 30 min');
    expect(html).toContain('2 h');
    expect(html).toContain('2 ukończonych, 1 pominiętych');
  });
});

describe('features/reflection/components/weekly-reflection-form', () => {
  const mockWeeklyState: WeeklyReflectionState = {
    currentWeek: '2026-10-12',
    previousWeek: '2026-10-05',
    currentReflection: null,
    previousReflection: {
      id: 'prev-1',
      user_id: 'u-1',
      week_start: '2026-10-05',
      fatigue: 4,
      stress: 4,
      focus: 2,
      distractions: 4,
      note: 'Ciężki tydzień',
      created_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
    },
  };

  it('should render weekly reflection form with all rating groups and controls', () => {
    const html = renderToStaticMarkup(
      React.createElement(WeeklyReflectionForm, {
        state: mockWeeklyState,
      }),
    );

    expect(html).toContain('Refleksja tygodniowa');
    expect(html).toContain('Bieżący tydzień (2026-10-12)');
    expect(html).toContain('Poprzedni (2026-10-05)');
    expect(html).toContain('Zmęczenie');
    expect(html).toContain('Stres');
    expect(html).toContain('Skupienie');
    expect(html).toContain('Rozpraszacze');
    expect(html).toContain('Notatka (opcjonalnie)');
    expect(html).toContain('Zapisz refleksję');
  });
});

describe('features/reflection/components/monthly-reflection-form', () => {
  const mockMonthlyState: MonthlyReflectionState = {
    currentMonth: '2026-10-01',
    previousMonth: '2026-09-01',
    currentReflection: null,
    previousReflection: null,
    currentStats: [],
    previousStats: [],
  };

  it('should render monthly review form with all 5 textual fields and stats', () => {
    const html = renderToStaticMarkup(
      React.createElement(MonthlyReflectionForm, {
        state: mockMonthlyState,
      }),
    );

    expect(html).toContain('Podsumowanie miesięczne');
    expect(html).toContain('Bieżący miesiąc (2026-10-01)');
    expect(html).toContain('Co poszło dobrze');
    expect(html).toContain('Co nie zadziałało');
    expect(html).toContain('Przegląd typów zadań');
    expect(html).toContain('Cele na kolejny miesiąc');
    expect(html).toContain('Zmiana priorytetów');
    expect(html).toContain('Zapisz podsumowanie');
  });
});

describe('features/reflection/components/reflection-view', () => {
  const baseProfile = {
    id: 'user-1',
    displayName: 'Test User',
    timezone: 'Europe/Warsaw',
  };

  it('should render ReflectionLocked when weekly state is null (basic level)', () => {
    const state: ReflectionState = {
      profile: { ...baseProfile, reflectionLevel: 'basic' },
      weekly: null,
      monthly: null,
    };

    const html = renderToStaticMarkup(
      React.createElement(ReflectionView, { state }),
    );

    expect(html).toContain('Tydzień');
    expect(html).toContain('Miesiąc');
    expect(html).toContain('Refleksja tygodniowa jest zablokowana');
  });

  it('should render WeeklyReflectionForm and locked monthly review when level is analytic', () => {
    const state: ReflectionState = {
      profile: { ...baseProfile, reflectionLevel: 'analytic' },
      weekly: {
        currentWeek: '2026-10-12',
        previousWeek: '2026-10-05',
        currentReflection: null,
        previousReflection: null,
      },
      monthly: null,
    };

    const htmlWeekly = renderToStaticMarkup(
      React.createElement(ReflectionView, { state, defaultTab: 'weekly' }),
    );
    expect(htmlWeekly).toContain('Refleksja tygodniowa');

    const htmlMonthly = renderToStaticMarkup(
      React.createElement(ReflectionView, { state, defaultTab: 'monthly' }),
    );
    expect(htmlMonthly).toContain('Podsumowanie miesięczne jest zablokowane');
  });

  it('should render both forms when level is strategic', () => {
    const state: ReflectionState = {
      profile: { ...baseProfile, reflectionLevel: 'strategic' },
      weekly: {
        currentWeek: '2026-10-12',
        previousWeek: '2026-10-05',
        currentReflection: null,
        previousReflection: null,
      },
      monthly: {
        currentMonth: '2026-10-01',
        previousMonth: '2026-09-01',
        currentReflection: null,
        previousReflection: null,
        currentStats: [],
        previousStats: [],
      },
    };

    const htmlWeekly = renderToStaticMarkup(
      React.createElement(ReflectionView, { state, defaultTab: 'weekly' }),
    );
    expect(htmlWeekly).toContain('Refleksja tygodniowa');

    const htmlMonthly = renderToStaticMarkup(
      React.createElement(ReflectionView, { state, defaultTab: 'monthly' }),
    );
    expect(htmlMonthly).toContain('Podsumowanie miesięczne');
  });
});
