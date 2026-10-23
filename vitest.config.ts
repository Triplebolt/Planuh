import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/.turbo/**'],
    hookTimeout: 30000,
    testTimeout: 30000,
    // Each test spins up its own PGlite (real Postgres compiled to WASM,
    // standing in for `docker compose up -d db`, per packages/db/src/test-db.ts).
    // Running many instances in parallel starves this sandbox; sequential
    // keeps CI deterministic without changing what's under test.
    fileParallelism: false,
  },
});
