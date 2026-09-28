import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Statystyki',
};

export default function StatsPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Statystyki</h1>
      <p className="mt-2 text-muted-foreground">Wkrótce.</p>
    </main>
  );
}
