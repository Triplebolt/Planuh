import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../test-app.js';

const ws1 = '11111111-1111-1111-1111-111111111111';

function headers(role: string) {
  return { 'x-workspace-id': ws1, 'x-user-role': role };
}

describe('resolve "Not set"', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.close();
  });

  async function setUpTypeAndValues() {
    const type = await ctx.app.inject({
      method: 'POST',
      url: '/segment-types',
      headers: headers('Admin'),
      payload: { name: 'Region' },
    });
    const typeId = type.json().id;
    const east = await ctx.app.inject({
      method: 'POST',
      url: `/segment-types/${typeId}/values`,
      headers: headers('Admin'),
      payload: { name: 'East' },
    });
    const west = await ctx.app.inject({
      method: 'POST',
      url: `/segment-types/${typeId}/values`,
      headers: headers('Admin'),
      payload: { name: 'West' },
    });
    return { typeId, eastId: east.json().id as string, westId: west.json().id as string };
  }

  it('[AC-SEG-003.4] splitting a "Not set" amount moves each part to its value', async () => {
    const { typeId, eastId, westId } = await setUpTypeAndValues();
    const allocation = await ctx.app.inject({
      method: 'POST',
      url: '/allocations',
      headers: headers('Manager'),
      payload: { name: 'Q1 ads', amountMinorUnits: '10000', currency: 'USD' },
    });
    const allocationId = allocation.json().id;

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/allocations/${allocationId}/split`,
      headers: headers('Manager'),
      payload: {
        segmentTypeId: typeId,
        parts: [
          { segmentValueId: eastId, amountMinorUnits: '4000' },
          { segmentValueId: westId, amountMinorUnits: '6000' },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const parts = res.json() as Array<{ id: string; amountMinorUnits: string }>;
    expect(parts).toHaveLength(2);
    const [first, second] = parts;
    expect(first?.amountMinorUnits).toBe('4000');
    expect(second?.amountMinorUnits).toBe('6000');
    expect(first?.id).toBe(allocationId);
  });

  it('[AC-SEG-002.4] refuses to split onto an archived segment value', async () => {
    const { typeId, eastId } = await setUpTypeAndValues();
    await ctx.app.inject({
      method: 'POST',
      url: `/segment-values/${eastId}/archive`,
      headers: headers('Admin'),
    });
    const allocation = await ctx.app.inject({
      method: 'POST',
      url: '/allocations',
      headers: headers('Manager'),
      payload: { name: 'Q1 ads', amountMinorUnits: '10000', currency: 'USD' },
    });

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/allocations/${allocation.json().id}/split`,
      headers: headers('Manager'),
      payload: {
        segmentTypeId: typeId,
        parts: [{ segmentValueId: eastId, amountMinorUnits: '10000' }],
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('archived_segment_value');
  });

  it('refuses a split value that belongs to a different segment type', async () => {
    const { typeId, eastId } = await setUpTypeAndValues();
    const otherType = await ctx.app.inject({
      method: 'POST',
      url: '/segment-types',
      headers: headers('Admin'),
      payload: { name: 'Brand' },
    });
    const otherValue = await ctx.app.inject({
      method: 'POST',
      url: `/segment-types/${otherType.json().id}/values`,
      headers: headers('Admin'),
      payload: { name: 'Acme' },
    });
    const allocation = await ctx.app.inject({
      method: 'POST',
      url: '/allocations',
      headers: headers('Manager'),
      payload: { name: 'Q1 ads', amountMinorUnits: '10000', currency: 'USD' },
    });

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/allocations/${allocation.json().id}/split`,
      headers: headers('Manager'),
      // segmentTypeId is Region, but the value belongs to Brand
      payload: {
        segmentTypeId: typeId,
        parts: [{ segmentValueId: otherValue.json().id, amountMinorUnits: '10000' }],
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('segment_value_type_mismatch');
    expect(eastId).toBeTruthy();
  });

  it('refuses to split an allocation that already has a concrete value for the type', async () => {
    const { typeId, eastId, westId } = await setUpTypeAndValues();
    const allocation = await ctx.app.inject({
      method: 'POST',
      url: '/allocations',
      headers: headers('Manager'),
      payload: { name: 'Q1 ads', amountMinorUnits: '10000', currency: 'USD' },
    });
    const allocationId = allocation.json().id;

    const first = await ctx.app.inject({
      method: 'POST',
      url: `/allocations/${allocationId}/split`,
      headers: headers('Manager'),
      payload: {
        segmentTypeId: typeId,
        parts: [{ segmentValueId: eastId, amountMinorUnits: '10000' }],
      },
    });
    expect(first.statusCode).toBe(200);

    const second = await ctx.app.inject({
      method: 'POST',
      url: `/allocations/${allocationId}/split`,
      headers: headers('Manager'),
      payload: {
        segmentTypeId: typeId,
        parts: [{ segmentValueId: westId, amountMinorUnits: '10000' }],
      },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe('allocation_already_assigned');
  });

  it('refuses a campaign segment value that belongs to a different segment type', async () => {
    const { typeId } = await setUpTypeAndValues();
    const otherType = await ctx.app.inject({
      method: 'POST',
      url: '/segment-types',
      headers: headers('Admin'),
      payload: { name: 'Brand' },
    });
    const otherValue = await ctx.app.inject({
      method: 'POST',
      url: `/segment-types/${otherType.json().id}/values`,
      headers: headers('Admin'),
      payload: { name: 'Acme' },
    });
    const allocation = await ctx.app.inject({
      method: 'POST',
      url: '/allocations',
      headers: headers('Manager'),
      payload: { name: 'Q1 ads', amountMinorUnits: '10000', currency: 'USD' },
    });
    const campaign = await ctx.app.inject({
      method: 'POST',
      url: '/campaigns',
      headers: headers('Manager'),
      payload: { allocationId: allocation.json().id, name: 'Spring launch' },
    });

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaign.json().id}/segments`,
      headers: headers('Manager'),
      payload: { segmentTypeId: typeId, segmentValueId: otherValue.json().id },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('segment_value_type_mismatch');
  });

  it('[AC-SEG-003.6] refuses a split whose amounts do not equal the "Not set" amount', async () => {
    const { typeId, eastId } = await setUpTypeAndValues();
    const allocation = await ctx.app.inject({
      method: 'POST',
      url: '/allocations',
      headers: headers('Manager'),
      payload: { name: 'Q1 ads', amountMinorUnits: '10000', currency: 'USD' },
    });

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/allocations/${allocation.json().id}/split`,
      headers: headers('Manager'),
      payload: {
        segmentTypeId: typeId,
        parts: [{ segmentValueId: eastId, amountMinorUnits: '9999' }],
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('split_amount_mismatch');
  });

  it('[AC-SEG-003.5] a user picking a value for a campaign replaces "Not set"', async () => {
    const { typeId, eastId } = await setUpTypeAndValues();
    const allocation = await ctx.app.inject({
      method: 'POST',
      url: '/allocations',
      headers: headers('Manager'),
      payload: { name: 'Q1 ads', amountMinorUnits: '10000', currency: 'USD' },
    });
    const campaign = await ctx.app.inject({
      method: 'POST',
      url: '/campaigns',
      headers: headers('Manager'),
      payload: { allocationId: allocation.json().id, name: 'Spring launch' },
    });

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaign.json().id}/segments`,
      headers: headers('Manager'),
      payload: { segmentTypeId: typeId, segmentValueId: eastId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().segmentValueId).toBe(eastId);
  });

  it('[AC-SEG-003.5] refuses an archived value for a campaign', async () => {
    const { typeId, eastId } = await setUpTypeAndValues();
    await ctx.app.inject({
      method: 'POST',
      url: `/segment-values/${eastId}/archive`,
      headers: headers('Admin'),
    });

    const allocation = await ctx.app.inject({
      method: 'POST',
      url: '/allocations',
      headers: headers('Manager'),
      payload: { name: 'Q1 ads', amountMinorUnits: '10000', currency: 'USD' },
    });
    const campaign = await ctx.app.inject({
      method: 'POST',
      url: '/campaigns',
      headers: headers('Manager'),
      payload: { allocationId: allocation.json().id, name: 'Spring launch' },
    });

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaign.json().id}/segments`,
      headers: headers('Manager'),
      payload: { segmentTypeId: typeId, segmentValueId: eastId },
    });
    expect(res.statusCode).toBe(422);
  });
});
