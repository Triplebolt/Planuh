import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../test-app.js';

const ws1 = '11111111-1111-1111-1111-111111111111';

function headers(role: string) {
  return { 'x-workspace-id': ws1, 'x-user-role': role };
}

describe('setup segments step and value picker', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('[AC-SEG-001.3] refuses to finish setup with no segment type', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/setup/complete',
      headers: headers('Admin'),
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().message).toMatch(/at least one segment type/i);
  });

  it('[AC-SEG-001.3] allows finishing setup once a segment type exists', async () => {
    await ctx.app.inject({
      method: 'POST',
      url: '/segment-types',
      headers: headers('Admin'),
      payload: { name: 'Region' },
    });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/setup/complete',
      headers: headers('Admin'),
    });
    expect(res.statusCode).toBe(200);
  });

  it('[AC-SEG-001.2] a value added to a type appears in the picker (GET /segment-types) for that type', async () => {
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

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/segment-types',
      headers: headers('Admin'),
    });
    const picked = list.json().find((t: { id: string }) => t.id === typeId);
    expect(picked.values.map((v: { name: string }) => v.name)).toContain('East');
  });
});
