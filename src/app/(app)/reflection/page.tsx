import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refleksja',
};

export default function ReflectionPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Refleksja</h1>
      <p className="mt-2 text-muted-foreground">Wkrótce.</p>
    </main>
  );
}
