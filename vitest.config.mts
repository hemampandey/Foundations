import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    include: ['lib/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
    coverage: { include: ['lib/**/*.ts'], exclude: ['lib/**/*.test.ts'] },
  },
});
