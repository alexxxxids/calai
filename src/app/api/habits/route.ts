import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isoDateSchema, toggleHabitCheckSchema } from '@/features/habits/schemas';
import { listHabitsForDay } from '@/features/habits/queries';
import { toggleHabitCheck } from '@/features/habits/actions';
import type { LocalDate } from '@/domain/types';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawDay = searchParams.get('day');

  const parseResult = isoDateSchema.safeParse(rawDay);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Nieprawidłowa data (oczekiwano YYYY-MM-DD)' },
      { status: 400 },
    );
  }

  try {
    const habits = await listHabitsForDay(supabase, parseResult.data as LocalDate);
    return NextResponse.json({ habits });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Błąd pobierania nawyków';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe ciało żądania' }, { status: 400 });
  }

  const parseResult = toggleHabitCheckSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Nieprawidłowe dane', details: parseResult.error.flatten() },
      { status: 400 },
    );
  }

  const result = await toggleHabitCheck(parseResult.data);
  if (result.status === 'error') {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
