import { DuplicateSegmentNameError } from './errors.js';

/**
 * Names are compared trimmed and case-insensitively (AC-SEG-001.4 assumption).
 */
export function normalizeSegmentName(name: string): string {
  return name.trim().toLowerCase();
}

export function assertUniqueName(
  scope: 'segment-type' | 'segment-value',
  name: string,
  existingNames: readonly string[],
): void {
  const normalized = normalizeSegmentName(name);
  const collides = existingNames.some((existing) => normalizeSegmentName(existing) === normalized);
  if (collides) {
    throw new DuplicateSegmentNameError(scope, name.trim());
  }
}
