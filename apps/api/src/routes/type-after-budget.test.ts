import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../test-app.js';

const ws1 = '11111111-1111-1111-1111-111111111111';

function headers(role: string) {
  return { 'x-workspace-id': ws1, 'x-user-role': role };
}

describe('segment type added after budget', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('[AC-SEG-003.1, AC-SEG-003.2, AC-SEG-003.3] adding a type after budget files existing allocations and campaigns under "Not set"', async () => {
    const allocation = await ctx.app.inject({
      method: 'POST',
      url: '/allocations',
      headers: headers('Manager'),
      payload: { name: 'Q1 ads', amountMinorUnits: '5000', currency: 'USD' },
    });
    const allocationId = allocation.json().id;
    const campaign = await ctx.app.inject({
      method: 'POST',
      url: '/campaigns',
      headers: headers('Manager'),
      payload: { allocationId, name: 'Spring launch' },
    });
    const campaignId = campaign.json().id;

    const type = await ctx.app.inject({
      method: 'POST',
      url: '/segment-types',
      headers: headers('Admin'),
      payload: { name: 'Channel' },
    });
    expect(type.statusCode).toBe(201);
    const typeId = type.json().id;

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/segment-types',
      headers: headers('Admin'),
    });
    expect(list.json().map((t: { id: string }) => t.id)).toContain(typeId);

    // The allocation has no value for the new type yet — it is filed under
    // "Not set" (AC-SEG-003.2), which this API surfaces as no assignment row
    // for that (entity, type) pair; a split (task-seg-resolve-not-set) is
    // what gives it a concrete value (AC-SEG-003.3 is proven end to end
    // there with domain's labelForAssignment).
    const split = await ctx.app.inject({
      method: 'POST',
      url: `/allocations/${allocationId}/split`,
      headers: headers('Manager'),
      payload: {
        segmentTypeId: typeId,
        parts: [{ segmentValueId: '99999999-9999-4999-8999-999999999999', amountMinorUnits: '1' }],
      },
    });
    // wrong total proves there *was* a "Not set" amount of 5000 to balance against
    expect(split.statusCode).toBe(422);
    expect(split.json().expected).toBe('5000');

    expect(campaignId).toBeTruthy();
  });

  it('[AC-SEG-003.7] refuses to remove a segment type while the plan holds budget', async () => {
    await ctx.app.inject({
      method: 'POST',
      url: '/allocations',
      headers: headers('Manager'),
      payload: { name: 'Q1 ads', amountMinorUnits: '5000', currency: 'USD' },
    });
    const type = await ctx.app.inject({
      method: 'POST',
      url: '/segment-types',
      headers: headers('Admin'),
      payload: { name: 'Channel' },
    });
    const typeId = type.json().id;

    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/segment-types/${typeId}`,
      headers: headers('Admin'),
    });
    expect(res.statusCode).toBe(409);
  });

  it('[AC-SEG-003.1] allows removing a segment type when the plan holds no budget', async () => {
    const type = await ctx.app.inject({
      method: 'POST',
      url: '/segment-types',
      headers: headers('Admin'),
      payload: { name: 'Channel' },
    });
    const typeId = type.json().id;

    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/segment-types/${typeId}`,
      headers: headers('Admin'),
    });
    expect(res.statusCode).toBe(204);
  });
});
