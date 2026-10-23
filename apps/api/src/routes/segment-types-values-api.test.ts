import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../test-app.js';

const ws1 = '11111111-1111-1111-1111-111111111111';

function headers(role: string, workspaceId = ws1) {
  return { 'x-workspace-id': workspaceId, 'x-user-role': role };
}

describe('segment types and values API', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('[AC-SEG-001.1] an Admin adding a segment type adds it to the workspace segment list', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/segment-types',
      headers: headers('Admin'),
      payload: { name: 'Region' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('Region');

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/segment-types',
      headers: headers('Admin'),
    });
    expect(list.json().map((t: { name: string }) => t.name)).toEqual(['Region']);
  });

  it('[AC-SEG-001.1] an Admin adding a value adds it to the segment type', async () => {
    const type = await ctx.app.inject({
      method: 'POST',
      url: '/segment-types',
      headers: headers('Admin'),
      payload: { name: 'Region' },
    });
    const typeId = type.json().id;

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/segment-types/${typeId}/values`,
      headers: headers('Admin'),
      payload: { name: 'East' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('East');
  });

  it('[AC-SEG-001.4] refuses a duplicate segment type name in the same workspace', async () => {
    await ctx.app.inject({
      method: 'POST',
      url: '/segment-types',
      headers: headers('Admin'),
      payload: { name: 'Region' },
    });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/segment-types',
      headers: headers('Admin'),
      payload: { name: 'region' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('[AC-SEG-001.4] refuses a duplicate segment value name in the same type', async () => {
    const type = await ctx.app.inject({
      method: 'POST',
      url: '/segment-types',
      headers: headers('Admin'),
      payload: { name: 'Region' },
    });
    const typeId = type.json().id;
    await ctx.app.inject({
      method: 'POST',
      url: `/segment-types/${typeId}/values`,
      headers: headers('Admin'),
      payload: { name: 'East' },
    });

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/segment-types/${typeId}/values`,
      headers: headers('Admin'),
      payload: { name: ' east ' },
    });
    expect(res.statusCode).toBe(409);
  });

  it.each(['Manager', 'CMO', 'Executor'])(
    '[AC-SEG-001.5] refuses a %s trying to add a segment type',
    async (role) => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/segment-types',
        headers: headers(role),
        payload: { name: 'Region' },
      });
      expect(res.statusCode).toBe(403);
    },
  );

  it.each(['Manager', 'CMO', 'Executor'])(
    '[AC-SEG-001.5] refuses a %s trying to add a segment value',
    async (role) => {
      const type = await ctx.app.inject({
        method: 'POST',
        url: '/segment-types',
        headers: headers('Admin'),
        payload: { name: 'Region' },
      });
      const typeId = type.json().id;
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/segment-types/${typeId}/values`,
        headers: headers(role),
        payload: { name: 'East' },
      });
      expect(res.statusCode).toBe(403);
    },
  );

  const ws2 = '22222222-2222-2222-2222-222222222222';

  it('refuses to add a value under a segment type id that belongs to another workspace', async () => {
    const type = await ctx.app.inject({
      method: 'POST',
      url: '/segment-types',
      headers: headers('Admin', ws2),
      payload: { name: 'Region' },
    });
    const typeId = type.json().id;

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/segment-types/${typeId}/values`,
      headers: headers('Admin', ws1),
      payload: { name: 'East' },
    });
    expect(res.statusCode).toBe(404);
  });
});
