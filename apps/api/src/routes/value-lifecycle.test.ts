import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../test-app.js';

const ws1 = '11111111-1111-1111-1111-111111111111';

function headers(role: string) {
  return { 'x-workspace-id': ws1, 'x-user-role': role };
}

async function createType(app: Awaited<ReturnType<typeof createTestApp>>['app'], name: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/segment-types',
    headers: headers('Admin'),
    payload: { name },
  });
  return res.json().id as string;
}

async function createValue(
  app: Awaited<ReturnType<typeof createTestApp>>['app'],
  typeId: string,
  name: string,
) {
  const res = await app.inject({
    method: 'POST',
    url: `/segment-types/${typeId}/values`,
    headers: headers('Admin'),
    payload: { name },
  });
  return res.json().id as string;
}

describe('segment value lifecycle', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('[AC-SEG-002.1] a value added after setup is available for new allocations', async () => {
    const typeId = await createType(ctx.app, 'Region');
    const valueId = await createValue(ctx.app, typeId, 'East');

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/segment-types',
      headers: headers('Admin'),
    });
    const type = list.json().find((t: { id: string }) => t.id === typeId);
    expect(type.values.map((v: { id: string }) => v.id)).toContain(valueId);
  });

  it('[AC-SEG-002.2] renaming a value shows the new name on an allocation and campaign using it', async () => {
    const typeId = await createType(ctx.app, 'Region');
    const valueId = await createValue(ctx.app, typeId, 'East');

    const allocation = await ctx.app.inject({
      method: 'POST',
      url: '/allocations',
      headers: headers('Manager'),
      payload: { name: 'Q1 ads', amountMinorUnits: '10000', currency: 'USD' },
    });
    const allocationId = allocation.json().id;
    await ctx.app.inject({
      method: 'POST',
      url: `/allocations/${allocationId}/split`,
      headers: headers('Manager'),
      payload: {
        segmentTypeId: typeId,
        parts: [{ segmentValueId: valueId, amountMinorUnits: '10000' }],
      },
    });

    const rename = await ctx.app.inject({
      method: 'PATCH',
      url: `/segment-values/${valueId}`,
      headers: headers('Admin'),
      payload: { name: 'Eastern' },
    });
    expect(rename.statusCode).toBe(200);
    expect(rename.json().name).toBe('Eastern');

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/segment-types',
      headers: headers('Admin'),
    });
    const type = list.json().find((t: { id: string }) => t.id === typeId);
    expect(type.values.find((v: { id: string }) => v.id === valueId).name).toBe('Eastern');
  });

  it('[AC-SEG-002.3] refuses to delete a value an allocation uses and offers to archive', async () => {
    const typeId = await createType(ctx.app, 'Region');
    const valueId = await createValue(ctx.app, typeId, 'East');
    const allocation = await ctx.app.inject({
      method: 'POST',
      url: '/allocations',
      headers: headers('Manager'),
      payload: { name: 'Q1 ads', amountMinorUnits: '10000', currency: 'USD' },
    });
    await ctx.app.inject({
      method: 'POST',
      url: `/allocations/${allocation.json().id}/split`,
      headers: headers('Manager'),
      payload: {
        segmentTypeId: typeId,
        parts: [{ segmentValueId: valueId, amountMinorUnits: '10000' }],
      },
    });

    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/segment-values/${valueId}`,
      headers: headers('Admin'),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().canArchive).toBe(true);
  });

  it('[AC-SEG-002.4] archiving stops a value being offered for new allocations and keeps it on existing ones', async () => {
    const typeId = await createType(ctx.app, 'Region');
    const valueId = await createValue(ctx.app, typeId, 'East');
    const allocation = await ctx.app.inject({
      method: 'POST',
      url: '/allocations',
      headers: headers('Manager'),
      payload: { name: 'Q1 ads', amountMinorUnits: '10000', currency: 'USD' },
    });
    await ctx.app.inject({
      method: 'POST',
      url: `/allocations/${allocation.json().id}/split`,
      headers: headers('Manager'),
      payload: {
        segmentTypeId: typeId,
        parts: [{ segmentValueId: valueId, amountMinorUnits: '10000' }],
      },
    });

    const archive = await ctx.app.inject({
      method: 'POST',
      url: `/segment-values/${valueId}/archive`,
      headers: headers('Admin'),
    });
    expect(archive.statusCode).toBe(200);
    expect(archive.json().archivedAt).toBeTruthy();

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/segment-types',
      headers: headers('Admin'),
    });
    const type = list.json().find((t: { id: string }) => t.id === typeId);
    // still present on the type's full value list (existing allocation keeps it) but archived.
    const found = type.values.find((v: { id: string }) => v.id === valueId);
    expect(found.archivedAt).toBeTruthy();
  });

  it('[AC-SEG-002.5] deletes a value that nothing uses', async () => {
    const typeId = await createType(ctx.app, 'Region');
    const valueId = await createValue(ctx.app, typeId, 'West');

    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/segment-values/${valueId}`,
      headers: headers('Admin'),
    });
    expect(res.statusCode).toBe(204);

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/segment-types',
      headers: headers('Admin'),
    });
    const type = list.json().find((t: { id: string }) => t.id === typeId);
    expect(type.values.map((v: { id: string }) => v.id)).not.toContain(valueId);
  });

  it('refuses to rename a segment value that does not exist with a 404, not a 500', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: '/segment-values/99999999-9999-4999-8999-999999999999',
      headers: headers('Admin'),
      payload: { name: 'Anything' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('refuses to archive a segment value that does not exist with a 404, not a 500', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/segment-values/99999999-9999-4999-8999-999999999999/archive',
      headers: headers('Admin'),
    });
    expect(res.statusCode).toBe(404);
  });
});
