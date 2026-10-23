export interface BudgetPresenceSummary {
  allocationCount: number;
  campaignCount: number;
}

/**
 * DEC-SEG-01 / REQ-SEG-003: a plan "holds budget" once it has an allocation or a
 * campaign (assumption — no fiscal-year-total table exists yet, confirm in review).
 */
export function planHoldsBudget(summary: BudgetPresenceSummary): boolean {
  return summary.allocationCount > 0 || summary.campaignCount > 0;
}
