import 'server-only';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { StatsView } from '@/features/stats/components/stats-view';
import { getStatsOverview } from '@/features/stats/queries';
import { parseStatsRange } from '@/features/stats/schemas';

export const metadata: Metadata = {
  title: 'Statystyki',
  description: 'Wykresy i zestawienia realizacji zadań, obciążenia oraz trendów samopoczucia.',
};

interface StatsPageProps {
  readonly searchParams: Promise<{ readonly range?: string }>;
}

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const range = parseStatsRange(params?.range);

  const data = await getStatsOverview(supabase, user.id, range);

  return <StatsView initialData={data} />;
}
