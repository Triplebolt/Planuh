import { describe, expect, it } from 'vitest';
import { NoSegmentTypeError } from './errors.js';
import { assertSegmentsReady } from './setup-readiness.js';

describe('assertSegmentsReady', () => {
  it('[AC-SEG-001.3] refuses to finish setup with zero segment types', () => {
    expect(() => assertSegmentsReady([])).toThrow(NoSegmentTypeError);
  });

  it('[AC-SEG-001.3] allows finishing setup with at least one segment type', () => {
    expect(() => assertSegmentsReady([{ id: 'type-1' }])).not.toThrow();
  });
});
