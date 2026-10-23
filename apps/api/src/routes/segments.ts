import { segmentsRepository, withTenantTransaction } from '@plannuh/db';
import {
  assertUniqueName,
  planHoldsBudget,
  SegmentTypeInUseError,
  SegmentValueInUseError,
} from '@plannuh/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { readAuthContext } from '../auth/context.js';
import { requireRole } from '../auth/require-role.js';

const createSegmentTypeBody = z.object({ name: z.string().min(1) });
const createSegmentValueBody = z.object({ name: z.string().min(1) });
const renameSegmentValueBody = z.object({ name: z.string().min(1) });
const idParams = z.object({ id: z.string().uuid() });

export function registerSegmentRoutes(app: FastifyInstance): void {
  /**
   * AC-SEG-001.1: list every segment type and its values for the workspace.
   */
  app.get('/segment-types', async (request) => {
    const auth = readAuthContext(request.headers);
    return withTenantTransaction(app.db, auth.workspaceId, (tx) =>
      segmentsRepository.listSegmentTypesWithValues(tx),
    );
  });

  /**
   * AC-SEG-001.1, AC-SEG-001.4, AC-SEG-001.5, AC-SEG-003.1, AC-SEG-003.2:
   * an Admin may add a segment type at any time, including once the plan
   * holds budget — in which case every existing allocation and campaign is
   * filed under "Not set" for it in the same transaction.
   */
  app.post('/segment-types', async (request, reply) => {
    const auth = readAuthContext(request.headers);
    requireRole(auth.role, ['Admin']);
    const body = createSegmentTypeBody.parse(request.body);

    const created = await withTenantTransaction(app.db, auth.workspaceId, async (tx) => {
      const existingNames = await segmentsRepository.listSegmentTypeNames(tx);
      assertUniqueName('segment-type', body.name, existingNames);
      const type = await segmentsRepository.createSegmentType(tx, auth.workspaceId, body.name);
      await segmentsRepository.fileExistingEntitiesAsNotSet(tx, auth.workspaceId, type.id);
      return type;
    });

    reply.code(201).send(created);
  });

  /**
   * AC-SEG-001.1, AC-SEG-001.2, AC-SEG-001.4, AC-SEG-001.5, AC-SEG-002.1
   */
  app.post<{ Params: { id: string } }>('/segment-types/:id/values', async (request, reply) => {
    const auth = readAuthContext(request.headers);
    requireRole(auth.role, ['Admin']);
    const { id } = idParams.parse(request.params);
    const body = createSegmentValueBody.parse(request.body);

    const created = await withTenantTransaction(app.db, auth.workspaceId, async (tx) => {
      const existingNames = await segmentsRepository.listSegmentValueNames(tx, id);
      assertUniqueName('segment-value', body.name, existingNames);
      return segmentsRepository.createSegmentValue(tx, auth.workspaceId, id, body.name);
    });

    reply.code(201).send(created);
  });

  /**
   * AC-SEG-002.2: renames propagate everywhere since nothing but the id is
   * ever copied onto an allocation or campaign.
   */
  app.patch<{ Params: { id: string } }>('/segment-values/:id', async (request) => {
    const auth = readAuthContext(request.headers);
    requireRole(auth.role, ['Admin']);
    const { id } = idParams.parse(request.params);
    const body = renameSegmentValueBody.parse(request.body);

    return withTenantTransaction(app.db, auth.workspaceId, async (tx) => {
      const value = await segmentsRepository.getSegmentValue(tx, id);
      if (value) {
        const siblingNames = (
          await segmentsRepository.listSegmentValueNames(tx, value.segmentTypeId)
        ).filter((name) => name !== value.name);
        assertUniqueName('segment-value', body.name, siblingNames);
      }
      return segmentsRepository.renameSegmentValue(tx, id, body.name);
    });
  });

  /**
   * AC-SEG-002.4: archiving stops the value being offered for new
   * allocations while existing ones keep it.
   */
  app.post<{ Params: { id: string } }>('/segment-values/:id/archive', async (request) => {
    const auth = readAuthContext(request.headers);
    requireRole(auth.role, ['Admin']);
    const { id } = idParams.parse(request.params);

    return withTenantTransaction(app.db, auth.workspaceId, (tx) =>
      segmentsRepository.archiveSegmentValue(tx, id),
    );
  });

  /**
   * AC-SEG-002.3, AC-SEG-002.5: delete only when nothing references the
   * value; otherwise refuse and offer to archive instead.
   */
  app.delete<{ Params: { id: string } }>('/segment-values/:id', async (request, reply) => {
    const auth = readAuthContext(request.headers);
    requireRole(auth.role, ['Admin']);
    const { id } = idParams.parse(request.params);

    await withTenantTransaction(app.db, auth.workspaceId, async (tx) => {
      const value = await segmentsRepository.getSegmentValue(tx, id);
      const usageCount = await segmentsRepository.countSegmentValueUsage(tx, id);
      if (usageCount > 0) {
        throw new SegmentValueInUseError(value?.name ?? id);
      }
      await segmentsRepository.deleteSegmentValue(tx, id);
    });

    reply.code(204).send();
  });

  /**
   * AC-SEG-003.7: refuse to remove a segment type while the plan holds
   * budget (DEC-SEG-01).
   */
  app.delete<{ Params: { id: string } }>('/segment-types/:id', async (request, reply) => {
    const auth = readAuthContext(request.headers);
    requireRole(auth.role, ['Admin']);
    const { id } = idParams.parse(request.params);

    await withTenantTransaction(app.db, auth.workspaceId, async (tx) => {
      const presence = await segmentsRepository.countBudgetPresence(tx);
      if (planHoldsBudget(presence)) {
        throw new SegmentTypeInUseError(id);
      }
      await segmentsRepository.deleteSegmentType(tx, id);
    });

    reply.code(204).send();
  });
}
