import { segmentsRepository, withTenantTransaction } from '@plannuh/db';
import { assertSegmentsReady } from '@plannuh/domain';
import type { FastifyInstance } from 'fastify';
import { readAuthContext } from '../auth/context.js';

/**
 * AC-SEG-001.3: setup refuses to finish with no segment type. The rest of
 * setup (reporting currency, fiscal year start, etc.) belongs to other
 * features; this route only guards the segments gate.
 */
export function registerSetupRoutes(app: FastifyInstance): void {
  app.post('/setup/complete', async (request, reply) => {
    const auth = readAuthContext(request.headers);

    await withTenantTransaction(app.db, auth.workspaceId, async (tx) => {
      const types = await segmentsRepository.listSegmentTypesWithValues(tx);
      assertSegmentsReady(types);
    });

    reply.code(200).send({ status: 'complete' });
  });
}
