import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../tenant.js';
import { createTestDb } from '../test-db.js';
import {
  countSegmentValueUsage,
  createSegmentType,
  createSegmentValue,
  listSegmentTypesWithValues,
} from './repository.js';

describe('segment RLS and repository', () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>;

  beforeEach(async () => {
    ctx = await createTestDb();
  });

  afterEach(async () => {
    await ctx.client.close();
  });

  const ws1 = '11111111-1111-1111-1111-111111111111';
  const ws2 = '22222222-2222-2222-2222-222222222222';

  it("ADR-002: a second workspace cannot see another workspace's segment types", async () => {
    await withTenantTransaction(ctx.db, ws1, async (tx) => {
      await createSegmentType(tx, ws1, 'Region');
    });
    await withTenantTransaction(ctx.db, ws2, async (tx) => {
      await createSegmentType(tx, ws2, 'Channel');
    });

    const asWs1 = await withTenantTransaction(ctx.db, ws1, (tx) => listSegmentTypesWithValues(tx));
    const asWs2 = await withTenantTransaction(ctx.db, ws2, (tx) => listSegmentTypesWithValues(tx));

    expect(asWs1.map((t) => t.name)).toEqual(['Region']);
    expect(asWs2.map((t) => t.name)).toEqual(['Channel']);
  });

  it('[AC-SEG-001.1] adding a segment type adds it to the workspace list', async () => {
    const created = await withTenantTransaction(ctx.db, ws1, (tx) =>
      createSegmentType(tx, ws1, 'Region'),
    );
    expect(created.name).toBe('Region');

    const list = await withTenantTransaction(ctx.db, ws1, (tx) => listSegmentTypesWithValues(tx));
    expect(list.map((t) => t.id)).toContain(created.id);
  });

  it('[AC-SEG-001.4] the database refuses a duplicate segment type name per workspace', async () => {
    await withTenantTransaction(ctx.db, ws1, async (tx) => {
      await createSegmentType(tx, ws1, 'Region');
      await expect(createSegmentType(tx, ws1, 'Region')).rejects.toThrow();
    });
  });

  it('counts how many assignments reference a segment value (used by the lifecycle in-use check)', async () => {
    await withTenantTransaction(ctx.db, ws1, async (tx) => {
      const type = await createSegmentType(tx, ws1, 'Region');
      const value = await createSegmentValue(tx, ws1, type.id, 'East');
      const unused = await countSegmentValueUsage(tx, value.id);
      expect(unused).toBe(0);
    });
  });
});
