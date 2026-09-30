import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { calendarQuerySchema, getCalendarItems } from '@/features/calendar';

export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parseResult = calendarQuerySchema.safeParse({
    start: searchParams.get('start'),
    end: searchParams.get('end'),
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Nieprawidłowy zakres dat', details: parseResult.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const items = await getCalendarItems(supabase, user.id, parseResult.data);
    return NextResponse.json(items);
  } catch {
    return NextResponse.json(
      { error: 'Błąd pobierania wydarzeń kalendarza' },
      { status: 500 },
    );
  }
}
