import { and, eq } from 'drizzle-orm';
import type * as schema from '../schema.js';
import { allocation, campaign, segmentAssignment, segmentType, segmentValue } from '../schema.js';
import type { TenantTransaction } from '../tenant.js';

type Tx = TenantTransaction<typeof schema>;

function firstOrThrow<T>(rows: readonly T[], what: string): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`expected ${what} to return a row`);
  }
  return row;
}

export async function listSegmentTypesWithValues(tx: Tx) {
  const types = await tx.select().from(segmentType);
  const values = await tx.select().from(segmentValue);
  return types.map((type) => ({
    ...type,
    values: values.filter((value) => value.segmentTypeId === type.id),
  }));
}

export async function listSegmentTypeNames(tx: Tx): Promise<string[]> {
  const rows = await tx.select({ name: segmentType.name }).from(segmentType);
  return rows.map((r) => r.name);
}

export async function listSegmentValueNames(tx: Tx, segmentTypeId: string): Promise<string[]> {
  const rows = await tx
    .select({ name: segmentValue.name })
    .from(segmentValue)
    .where(eq(segmentValue.segmentTypeId, segmentTypeId));
  return rows.map((r) => r.name);
}

export async function createSegmentType(tx: Tx, workspaceId: string, name: string) {
  const rows = await tx.insert(segmentType).values({ workspaceId, name: name.trim() }).returning();
  return firstOrThrow(rows, 'createSegmentType');
}

export async function createSegmentValue(
  tx: Tx,
  workspaceId: string,
  segmentTypeId: string,
  name: string,
) {
  const rows = await tx
    .insert(segmentValue)
    .values({ workspaceId, segmentTypeId, name: name.trim() })
    .returning();
  return firstOrThrow(rows, 'createSegmentValue');
}

export async function getSegmentType(tx: Tx, id: string) {
  const rows = await tx.select().from(segmentType).where(eq(segmentType.id, id));
  return rows[0] ?? null;
}

export async function getSegmentValue(tx: Tx, id: string) {
  const rows = await tx.select().from(segmentValue).where(eq(segmentValue.id, id));
  return rows[0] ?? null;
}

export async function renameSegmentValue(tx: Tx, id: string, name: string) {
  const rows = await tx
    .update(segmentValue)
    .set({ name: name.trim() })
    .where(eq(segmentValue.id, id))
    .returning();
  return firstOrThrow(rows, 'renameSegmentValue');
}

export async function archiveSegmentValue(tx: Tx, id: string) {
  const rows = await tx
    .update(segmentValue)
    .set({ archivedAt: new Date() })
    .where(eq(segmentValue.id, id))
    .returning();
  return firstOrThrow(rows, 'archiveSegmentValue');
}

export async function countSegmentValueUsage(tx: Tx, segmentValueId: string): Promise<number> {
  const rows = await tx
    .select({ id: segmentAssignment.id })
    .from(segmentAssignment)
    .where(eq(segmentAssignment.segmentValueId, segmentValueId));
  return rows.length;
}

export async function deleteSegmentValue(tx: Tx, id: string) {
  await tx.delete(segmentValue).where(eq(segmentValue.id, id));
}

export async function countBudgetPresence(tx: Tx) {
  const allocations = await tx.select({ id: allocation.id }).from(allocation);
  const campaigns = await tx.select({ id: campaign.id }).from(campaign);
  return { allocationCount: allocations.length, campaignCount: campaigns.length };
}

export async function deleteSegmentType(tx: Tx, id: string) {
  await tx.delete(segmentType).where(eq(segmentType.id, id));
}

/**
 * AC-SEG-003.2: file every existing allocation and campaign under "Not set"
 * (a segment_assignment row with a null value) for a newly added type.
 */
export async function fileExistingEntitiesAsNotSet(
  tx: Tx,
  workspaceId: string,
  segmentTypeId: string,
) {
  const allocations = await tx.select({ id: allocation.id }).from(allocation);
  const campaigns = await tx.select({ id: campaign.id }).from(campaign);

  const rows = [
    ...allocations.map((a) => ({
      workspaceId,
      entityType: 'allocation' as const,
      entityId: a.id,
      segmentTypeId,
      segmentValueId: null,
    })),
    ...campaigns.map((c) => ({
      workspaceId,
      entityType: 'campaign' as const,
      entityId: c.id,
      segmentTypeId,
      segmentValueId: null,
    })),
  ];

  if (rows.length > 0) {
    await tx.insert(segmentAssignment).values(rows);
  }
}

export async function getAssignment(
  tx: Tx,
  entityType: 'allocation' | 'campaign',
  entityId: string,
  segmentTypeId: string,
) {
  const rows = await tx
    .select()
    .from(segmentAssignment)
    .where(
      and(
        eq(segmentAssignment.entityType, entityType),
        eq(segmentAssignment.entityId, entityId),
        eq(segmentAssignment.segmentTypeId, segmentTypeId),
      ),
    );
  return rows[0] ?? null;
}

export async function setAssignmentValue(
  tx: Tx,
  workspaceId: string,
  entityType: 'allocation' | 'campaign',
  entityId: string,
  segmentTypeId: string,
  segmentValueId: string | null,
) {
  const existing = await getAssignment(tx, entityType, entityId, segmentTypeId);
  if (existing) {
    const rows = await tx
      .update(segmentAssignment)
      .set({ segmentValueId })
      .where(eq(segmentAssignment.id, existing.id))
      .returning();
    return firstOrThrow(rows, 'setAssignmentValue (update)');
  }
  const rows = await tx
    .insert(segmentAssignment)
    .values({ workspaceId, entityType, entityId, segmentTypeId, segmentValueId })
    .returning();
  return firstOrThrow(rows, 'setAssignmentValue (insert)');
}

export async function getAllocation(tx: Tx, id: string) {
  const rows = await tx.select().from(allocation).where(eq(allocation.id, id));
  return rows[0] ?? null;
}

export async function getCampaign(tx: Tx, id: string) {
  const rows = await tx.select().from(campaign).where(eq(campaign.id, id));
  return rows[0] ?? null;
}

export async function createAllocation(
  tx: Tx,
  workspaceId: string,
  input: { name: string; amountMinorUnits: bigint; currency: string },
) {
  const rows = await tx
    .insert(allocation)
    .values({ workspaceId, ...input })
    .returning();
  return firstOrThrow(rows, 'createAllocation');
}

export async function createCampaign(
  tx: Tx,
  workspaceId: string,
  allocationId: string,
  name: string,
) {
  const rows = await tx.insert(campaign).values({ workspaceId, allocationId, name }).returning();
  return firstOrThrow(rows, 'createCampaign');
}

export async function deleteAllocation(tx: Tx, id: string) {
  await tx.delete(allocation).where(eq(allocation.id, id));
}

export async function updateAllocationAmount(tx: Tx, id: string, amountMinorUnits: bigint) {
  const rows = await tx
    .update(allocation)
    .set({ amountMinorUnits })
    .where(eq(allocation.id, id))
    .returning();
  return firstOrThrow(rows, 'updateAllocationAmount');
}

export async function listAssignmentsForEntity(
  tx: Tx,
  entityType: 'allocation' | 'campaign',
  entityId: string,
) {
  return tx
    .select()
    .from(segmentAssignment)
    .where(
      and(eq(segmentAssignment.entityType, entityType), eq(segmentAssignment.entityId, entityId)),
    );
}
