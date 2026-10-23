import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'drizzle');

/**
 * A fresh, migrated database for tests. Standing up the real Aurora
 * Postgres named in the runbook (`docker compose up -d db`) is not
 * available in this execution environment, so tests run against PGlite —
 * a real Postgres engine compiled to WASM, not a mock — which runs the
 * same migration SQL (including the RLS policies) unmodified.
 */
export async function createTestDb() {
  const client = new PGlite();
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sqlText = readFileSync(join(migrationsDir, file), 'utf8');
    await client.exec(sqlText);
  }
  // The api connects as app_role (ADR-002: not the table owner, no BYPASSRLS).
  await client.exec('SET ROLE app_role;');

  const db = drizzle(client, { schema });
  return { db, client };
}
