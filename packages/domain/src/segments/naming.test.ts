import { describe, expect, it } from 'vitest';
import { DuplicateSegmentNameError } from './errors.js';
import { assertUniqueName } from './naming.js';

describe('assertUniqueName', () => {
  it('[AC-SEG-001.4] allows a segment type name that does not collide', () => {
    expect(() => assertUniqueName('segment-type', 'Region', ['Channel'])).not.toThrow();
  });

  it('[AC-SEG-001.4] refuses a segment type name that duplicates an existing one', () => {
    expect(() => assertUniqueName('segment-type', 'Region', ['Channel', 'Region'])).toThrow(
      DuplicateSegmentNameError,
    );
  });

  it('[AC-SEG-001.4] refuses a segment value name that duplicates one in the same type, trimmed and case-insensitive', () => {
    expect(() => assertUniqueName('segment-value', '  east  ', ['East'])).toThrow(DuplicateSegmentNameError);
  });

  it('[AC-SEG-001.4] allows the same value name in a different scope (caller passes only same-scope names)', () => {
    expect(() => assertUniqueName('segment-value', 'East', ['West'])).not.toThrow();
  });
});
