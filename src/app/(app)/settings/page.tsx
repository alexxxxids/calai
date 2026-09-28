import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ustawienia',
};

export default function SettingsPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Ustawienia</h1>
      <p className="mt-2 text-muted-foreground">Wkrótce.</p>
    </main>
  );
}
