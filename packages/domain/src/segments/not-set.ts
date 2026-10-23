export const NOT_SET_LABEL = 'Not set';

/**
 * A segment assignment with a null value id represents "Not set" — no copied
 * name is stored, so a rename of a real value never touches these rows.
 */
export interface SegmentValueLabel {
  segmentValueId: string | null;
  label: string;
  archived: boolean;
}

export function labelForAssignment(
  value: { id: string; name: string; archivedAt: Date | null } | null,
): SegmentValueLabel {
  if (value === null) {
    return { segmentValueId: null, label: NOT_SET_LABEL, archived: false };
  }
  return { segmentValueId: value.id, label: value.name, archived: value.archivedAt !== null };
}
