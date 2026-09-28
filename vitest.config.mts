import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Vite 8 reads "paths" from tsconfig.json itself, so "@/..." imports work in tests.
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
