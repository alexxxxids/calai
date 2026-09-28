'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  createHabitSchema,
  updateHabitSchema,
  toggleHabitCheckSchema,
  type ToggleHabitCheckInput,
} from './schemas';

export interface HabitActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function createHabit(
  _prevState: HabitActionState,
  formData: FormData,
): Promise<HabitActionState> {
  const rawName = formData.get('name');
  const rawWeekdays = formData.getAll('weekdays');

  // weekdays mogą przyjść jako lista stringów lub jeden string po przecinku
  const parsedWeekdays = rawWeekdays
    .flatMap((val) => (typeof val === 'string' ? val.split(',') : []))
    .map((v) => Number(v.trim()))
    .filter((n) => !Number.isNaN(n));

  const parseResult = createHabitSchema.safeParse({
    name: rawName,
    weekdays: parsedWeekdays,
  });

  if (!parseResult.success) {
    return {
      status: 'error',
      message: 'Nieprawidłowe dane formularza',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('habits').insert({
    name: parseResult.data.name,
    weekdays: parseResult.data.weekdays,
  });

  if (error) {
    return {
      status: 'error',
      message: `Błąd zapisu nawyku: ${error.message}`,
    };
  }

  revalidatePath('/habits');
  revalidatePath('/calendar');
  return { status: 'success', message: 'Nawyk został utworzony' };
}

export async function updateHabit(
  _prevState: HabitActionState,
  formData: FormData,
): Promise<HabitActionState> {
  const rawId = formData.get('id');
  const rawName = formData.get('name');
  const rawWeekdays = formData.getAll('weekdays');

  const parsedWeekdays = rawWeekdays
    .flatMap((val) => (typeof val === 'string' ? val.split(',') : []))
    .map((v) => Number(v.trim()))
    .filter((n) => !Number.isNaN(n));

  const parseResult = updateHabitSchema.safeParse({
    id: rawId,
    name: rawName,
    weekdays: parsedWeekdays,
  });

  if (!parseResult.success) {
    return {
      status: 'error',
      message: 'Nieprawidłowe dane formularza',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('habits')
    .update({
      name: parseResult.data.name,
      weekdays: parseResult.data.weekdays,
    })
    .eq('id', parseResult.data.id);

  if (error) {
    return {
      status: 'error',
      message: `Błąd aktualizacji nawyku: ${error.message}`,
    };
  }

  revalidatePath('/habits');
  revalidatePath('/calendar');
  return { status: 'success', message: 'Nawyk został zaktualizowany' };
}

export async function archiveHabit(habitId: string): Promise<HabitActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('habits')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', habitId);

  if (error) {
    return {
      status: 'error',
      message: `Nie udało się zarchiwizować nawyku: ${error.message}`,
    };
  }

  revalidatePath('/habits');
  revalidatePath('/calendar');
  return { status: 'success', message: 'Nawyk został zarchiwizowany' };
}

export async function unarchiveHabit(habitId: string): Promise<HabitActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('habits')
    .update({ archived_at: null })
    .eq('id', habitId);

  if (error) {
    return {
      status: 'error',
      message: `Nie udało się przywrócić nawyku: ${error.message}`,
    };
  }

  revalidatePath('/habits');
  revalidatePath('/calendar');
  return { status: 'success', message: 'Nawyk został przywrócony' };
}

export async function deleteHabit(habitId: string): Promise<HabitActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('id', habitId);

  if (error) {
    return {
      status: 'error',
      message: `Nie udało się usunąć nawyku: ${error.message}`,
    };
  }

  revalidatePath('/habits');
  revalidatePath('/calendar');
  return { status: 'success', message: 'Nawyk został trwale usunięty' };
}

export async function toggleHabitCheck(
  input: ToggleHabitCheckInput,
): Promise<HabitActionState> {
  const parseResult = toggleHabitCheckSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      status: 'error',
      message: 'Nieprawidłowe parametry oznaczenia nawyku',
    };
  }

  const { habitId, day, done } = parseResult.data;
  const supabase = await createClient();

  if (done) {
    // Wstawienie oznaczenia
    const { error } = await supabase.from('habit_checks').insert({
      habit_id: habitId,
      day,
    });

    // Ignoruj błąd unikalności (23505), jeśli oznaczenie już istniało
    if (error && error.code !== '23505') {
      return {
        status: 'error',
        message: `Błąd oznaczania nawyku: ${error.message}`,
      };
    }
  } else {
    // Usunięcie oznaczenia
    const { error } = await supabase
      .from('habit_checks')
      .delete()
      .eq('habit_id', habitId)
      .eq('day', day);

    if (error) {
      return {
        status: 'error',
        message: `Błąd usuwania oznaczenia: ${error.message}`,
      };
    }
  }

  revalidatePath('/habits');
  revalidatePath('/calendar');
  return { status: 'success' };
}
