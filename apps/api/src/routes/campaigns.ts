import { segmentsRepository, withTenantTransaction } from '@plannuh/db';
import { ArchivedSegmentValueError } from '@plannuh/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { readAuthContext } from '../auth/context.js';
import { requireRole } from '../auth/require-role.js';

const createCampaignBody = z.object({ allocationId: z.string().uuid(), name: z.string().min(1) });
const setSegmentBody = z.object({
  segmentTypeId: z.string().uuid(),
  segmentValueId: z.string().uuid(),
});
const idParams = z.object({ id: z.string().uuid() });

/**
 * Campaign Plan owns the real campaign CRUD surface. This route exists only
 * so the segment tasks have a concrete campaign to file under "Not set" and
 * resolve — not a full campaign API.
 */
export function registerCampaignRoutes(app: FastifyInstance): void {
  app.post('/campaigns', async (request, reply) => {
    const auth = readAuthContext(request.headers);
    requireRole(auth.role, ['Admin', 'Manager']);
    const body = createCampaignBody.parse(request.body);

    const created = await withTenantTransaction(app.db, auth.workspaceId, (tx) =>
      segmentsRepository.createCampaign(tx, auth.workspaceId, body.allocationId, body.name),
    );

    reply.code(201).send(created);
  });

  /**
   * AC-SEG-003.5: picking a value of the new type replaces "Not set" on the
   * campaign. Archived values are refused.
   */
  app.patch<{ Params: { id: string } }>('/campaigns/:id/segments', async (request) => {
    const auth = readAuthContext(request.headers);
    requireRole(auth.role, ['Admin', 'Manager']);
    const { id } = idParams.parse(request.params);
    const body = setSegmentBody.parse(request.body);

    return withTenantTransaction(app.db, auth.workspaceId, async (tx) => {
      const value = await segmentsRepository.getSegmentValue(tx, body.segmentValueId);
      if (value?.archivedAt) {
        throw new ArchivedSegmentValueError(value.name);
      }
      return segmentsRepository.setAssignmentValue(
        tx,
        auth.workspaceId,
        'campaign',
        id,
        body.segmentTypeId,
        body.segmentValueId,
      );
    });
  });
}
