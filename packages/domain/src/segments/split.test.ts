import { describe, expect, it } from 'vitest';
import { SplitAmountMismatchError } from './errors.js';
import { assertSplitBalances } from './split.js';

describe('assertSplitBalances', () => {
  it('[AC-SEG-003.6] allows parts that sum exactly to the "Not set" amount', () => {
    expect(() =>
      assertSplitBalances(10_000n, [
        { segmentValueId: 'v1', amountMinorUnits: 4_000n },
        { segmentValueId: 'v2', amountMinorUnits: 6_000n },
      ]),
    ).not.toThrow();
  });

  it('[AC-SEG-003.6] refuses a split that sums below the "Not set" amount', () => {
    expect(() =>
      assertSplitBalances(10_000n, [{ segmentValueId: 'v1', amountMinorUnits: 9_999n }]),
    ).toThrow(SplitAmountMismatchError);
  });

  it('[AC-SEG-003.6] refuses a split that sums above the "Not set" amount', () => {
    expect(() =>
      assertSplitBalances(10_000n, [{ segmentValueId: 'v1', amountMinorUnits: 10_001n }]),
    ).toThrow(SplitAmountMismatchError);
  });
});
