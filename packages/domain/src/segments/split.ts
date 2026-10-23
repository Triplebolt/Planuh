import { SplitAmountMismatchError } from './errors.js';

export interface SplitPart {
  segmentValueId: string;
  amountMinorUnits: bigint;
}

/**
 * AC-SEG-003.6: the split parts must sum to exactly the "Not set" amount
 * being split. Compared as integer minor units (ADR-003) to avoid float drift.
 */
export function assertSplitBalances(
  notSetAmountMinorUnits: bigint,
  parts: readonly SplitPart[],
): void {
  const total = parts.reduce((sum, part) => sum + part.amountMinorUnits, 0n);
  if (total !== notSetAmountMinorUnits) {
    throw new SplitAmountMismatchError(notSetAmountMinorUnits, total);
  }
}
