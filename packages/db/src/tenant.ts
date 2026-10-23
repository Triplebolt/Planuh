import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';

export type TenantTransaction<TSchema extends Record<string, unknown> = Record<string, never>> =
  PgTransaction<PgQueryResultHKT, TSchema>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ADR-002: every request's queries run inside a transaction that has set the
 * tenant's workspace id for Postgres row-level security to key off. Never
 * pass workspace_id as an application-level filter instead of this.
 *
 * `SET LOCAL` cannot bind a query parameter, so the workspace id is validated
 * as a UUID and inlined rather than passed through user-controlled SQL.
 */
export async function withTenantTransaction<TSchema extends Record<string, unknown>, T>(
  db: PgDatabase<PgQueryResultHKT, TSchema>,
  workspaceId: string,
  fn: (tx: TenantTransaction<TSchema>) => Promise<T>,
): Promise<T> {
  if (!UUID_PATTERN.test(workspaceId)) {
    throw new Error(`workspaceId must be a UUID, got: ${workspaceId}`);
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL app.workspace_id = '${workspaceId}'`));
    return fn(tx as TenantTransaction<TSchema>);
  });
}
