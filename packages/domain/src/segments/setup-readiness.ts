import { NoSegmentTypeError } from './errors.js';

export interface SegmentTypeSummary {
  id: string;
}

/**
 * AC-SEG-001.3: setup cannot finish with zero segment types.
 */
export function assertSegmentsReady(types: readonly SegmentTypeSummary[]): void {
  if (types.length === 0) {
    throw new NoSegmentTypeError();
  }
}
