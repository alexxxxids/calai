'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * next-themes keeps the chosen theme in localStorage and puts the `dark` class on <html>.
 * It needs browser APIs, so it lives in a Client Component, while the root layout stays on the server.
 */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
