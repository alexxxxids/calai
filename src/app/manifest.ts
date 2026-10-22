import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CalAI — Inteligentny planer czasu',
    short_name: 'CalAI',
    description: 'Inteligentny planer czasu: sam układa zadania w wolnych okienkach kalendarza.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
