import { describe, expect, it } from 'vitest';
import { labelForAssignment } from './not-set.js';

describe('labelForAssignment', () => {
  it('[AC-SEG-003.3] labels a null assignment as "Not set"', () => {
    expect(labelForAssignment(null)).toEqual({ segmentValueId: null, label: 'Not set', archived: false });
  });

  it('[AC-SEG-003.3] labels an assigned value with its own name', () => {
    expect(labelForAssignment({ id: 'v1', name: 'East', archivedAt: null })).toEqual({
      segmentValueId: 'v1',
      label: 'East',
      archived: false,
    });
  });

  it('marks an archived value label as archived (task-seg-value-lifecycle)', () => {
    expect(labelForAssignment({ id: 'v1', name: 'East', archivedAt: new Date() }).archived).toBe(true);
  });
});
