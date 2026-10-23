import { describe, expect, it } from 'vitest';
import { planHoldsBudget } from './budget-presence.js';

describe('planHoldsBudget', () => {
  it('[AC-SEG-003.1] is false with no allocations and no campaigns', () => {
    expect(planHoldsBudget({ allocationCount: 0, campaignCount: 0 })).toBe(false);
  });

  it('[AC-SEG-003.1] is true once an allocation exists', () => {
    expect(planHoldsBudget({ allocationCount: 1, campaignCount: 0 })).toBe(true);
  });

  it('[AC-SEG-003.1] is true once a campaign exists', () => {
    expect(planHoldsBudget({ allocationCount: 0, campaignCount: 1 })).toBe(true);
  });
});
