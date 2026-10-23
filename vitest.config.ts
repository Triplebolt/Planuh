import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/.turbo/**'],
    hookTimeout: 30000,
    testTimeout: 30000,
    // Each test spins up its own PGlite (real Postgres compiled to WASM,
    // standing in for `docker compose up -d db`, per packages/db/src/test-db.ts).
    // Running many instances in parallel starves this sandbox; sequential
    // keeps CI deterministic without changing what's under test.
    fileParallelism: false,
    // apps/web components render against the DOM; every other package is
    // pure Node (domain rules, the API, the db layer).
    environmentMatchGlobs: [['apps/web/**', 'jsdom']],
    setupFiles: ['./apps/web/src/test/setup.ts'],
  },
});
