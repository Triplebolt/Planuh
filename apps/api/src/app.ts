import type { schema } from '@plannuh/db';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import Fastify, { type FastifyInstance } from 'fastify';
import { errorHandler } from './errors/handler.js';
import { registerAllocationRoutes } from './routes/allocations.js';
import { registerCampaignRoutes } from './routes/campaigns.js';
import { registerSegmentRoutes } from './routes/segments.js';
import { registerSetupRoutes } from './routes/setup.js';

export type AppDb = PgDatabase<PgQueryResultHKT, typeof schema>;

// ADR-003 stores amounts as bigint minor units. JSON has no bigint type, so
// responses serialize them as decimal strings rather than losing precision
// the way `Number(amount)` would for large totals.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}
// biome-ignore lint/suspicious/noExplicitAny: patching a built-in prototype
(BigInt.prototype as any).toJSON = function (this: bigint) {
  return this.toString();
};

declare module 'fastify' {
  interface FastifyInstance {
    db: AppDb;
  }
}

export function buildApp(db: AppDb): FastifyInstance {
  const app = Fastify({ logger: false });
  app.decorate('db', db);
  app.setErrorHandler(errorHandler);

  registerSegmentRoutes(app);
  registerSetupRoutes(app);
  registerAllocationRoutes(app);
  registerCampaignRoutes(app);

  return app;
}
