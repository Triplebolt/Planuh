import { segmentsRepository, withTenantTransaction } from '@plannuh/db';
import { assertSplitBalances } from '@plannuh/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { readAuthContext } from '../auth/context.js';
import { requireRole } from '../auth/require-role.js';

const createAllocationBody = z.object({
  name: z.string().min(1),
  amountMinorUnits: z.coerce.bigint(),
  currency: z.string().length(3),
});

const splitBody = z.object({
  segmentTypeId: z.string().uuid(),
  parts: z
    .array(z.object({ segmentValueId: z.string().uuid(), amountMinorUnits: z.coerce.bigint() }))
    .min(1),
});

const idParams = z.object({ id: z.string().uuid() });

/**
 * Budget Allocation owns the real allocation CRUD surface. This route exists
 * only so the segment tasks have a concrete allocation to file under
 * "Not set" and split — not a full allocation API.
 */
export function registerAllocationRoutes(app: FastifyInstance): void {
  app.post('/allocations', async (request, reply) => {
    const auth = readAuthContext(request.headers);
    requireRole(auth.role, ['Admin', 'Manager']);
    const body = createAllocationBody.parse(request.body);

    const created = await withTenantTransaction(app.db, auth.workspaceId, (tx) =>
      segmentsRepository.createAllocation(tx, auth.workspaceId, body),
    );

    reply.code(201).send(created);
  });

  /**
   * AC-SEG-003.4, AC-SEG-003.6: split an allocation's "Not set" amount for a
   * segment type across concrete values. The first part keeps the original
   * allocation's id (so its campaigns stay attached); later parts become new
   * allocations copying the original's other segment assignments.
   */
  app.post<{ Params: { id: string } }>('/allocations/:id/split', async (request, reply) => {
    const auth = readAuthContext(request.headers);
    requireRole(auth.role, ['Admin', 'Manager']);
    const { id } = idParams.parse(request.params);
    const body = splitBody.parse(request.body);

    const result = await withTenantTransaction(app.db, auth.workspaceId, async (tx) => {
      const original = await segmentsRepository.getAllocation(tx, id);
      if (!original) {
        throw new Error(`allocation ${id} not found`);
      }
      assertSplitBalances(original.amountMinorUnits, body.parts);

      const otherAssignments = (
        await segmentsRepository.listAssignmentsForEntity(tx, 'allocation', id)
      ).filter((a) => a.segmentTypeId !== body.segmentTypeId);

      const created = [];
      for (const [index, part] of body.parts.entries()) {
        const target =
          index === 0
            ? await segmentsRepository.updateAllocationAmount(tx, id, part.amountMinorUnits)
            : await segmentsRepository.createAllocation(tx, auth.workspaceId, {
                name: original.name,
                amountMinorUnits: part.amountMinorUnits,
                currency: original.currency,
              });

        for (const assignment of otherAssignments) {
          await segmentsRepository.setAssignmentValue(
            tx,
            auth.workspaceId,
            'allocation',
            target.id,
            assignment.segmentTypeId,
            assignment.segmentValueId,
          );
        }
        await segmentsRepository.setAssignmentValue(
          tx,
          auth.workspaceId,
          'allocation',
          target.id,
          body.segmentTypeId,
          part.segmentValueId,
        );

        created.push(target);
      }
      return created;
    });

    reply.code(200).send(result);
  });
}
