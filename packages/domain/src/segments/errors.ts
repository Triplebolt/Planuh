export class DuplicateSegmentNameError extends Error {
  readonly scope: 'segment-type' | 'segment-value';
  readonly name_: string;

  constructor(scope: 'segment-type' | 'segment-value', name: string) {
    super(
      `A ${scope === 'segment-type' ? 'segment type' : 'segment value'} named "${name}" already exists`,
    );
    this.name = 'DuplicateSegmentNameError';
    this.scope = scope;
    this.name_ = name;
  }
}

export class NoSegmentTypeError extends Error {
  constructor() {
    super('At least one segment type is required to finish setup');
    this.name = 'NoSegmentTypeError';
  }
}

export class SegmentValueInUseError extends Error {
  readonly canArchive = true;

  constructor(valueName: string) {
    super(`"${valueName}" is used by an allocation or campaign and cannot be deleted`);
    this.name = 'SegmentValueInUseError';
  }
}

export class SegmentTypeInUseError extends Error {
  constructor(typeName: string) {
    super(`"${typeName}" cannot be removed while the plan holds budget`);
    this.name = 'SegmentTypeInUseError';
  }
}

export class SplitAmountMismatchError extends Error {
  readonly expected: bigint;
  readonly actual: bigint;

  constructor(expected: bigint, actual: bigint) {
    super(`Split amounts (${actual}) must equal the "Not set" amount (${expected})`);
    this.name = 'SplitAmountMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}

export class ArchivedSegmentValueError extends Error {
  constructor(valueName: string) {
    super(`"${valueName}" is archived and cannot be assigned`);
    this.name = 'ArchivedSegmentValueError';
  }
}

export class SegmentTypeNotFoundError extends Error {
  constructor(id: string) {
    super(`No segment type "${id}" in this workspace`);
    this.name = 'SegmentTypeNotFoundError';
  }
}

export class SegmentValueNotFoundError extends Error {
  constructor(id: string) {
    super(`No segment value "${id}" in this workspace`);
    this.name = 'SegmentValueNotFoundError';
  }
}

export class AllocationNotFoundError extends Error {
  constructor(id: string) {
    super(`No allocation "${id}" in this workspace`);
    this.name = 'AllocationNotFoundError';
  }
}

/**
 * A segment value must belong to the segment type it is being assigned
 * under — the foreign key only proves the value row exists somewhere, not
 * that it belongs to the right type (or the caller's workspace, since a
 * cross-workspace id resolves to null through RLS rather than this error).
 */
export class SegmentValueTypeMismatchError extends Error {
  constructor(valueId: string, segmentTypeId: string) {
    super(`Segment value "${valueId}" does not belong to segment type "${segmentTypeId}"`);
    this.name = 'SegmentValueTypeMismatchError';
  }
}

/**
 * A split only makes sense while the allocation is "Not set" for the given
 * type — i.e. no segment_assignment row for it carries a concrete value yet.
 */
export class AllocationAlreadyAssignedError extends Error {
  constructor(segmentTypeId: string) {
    super(
      `This allocation already has a value for segment type "${segmentTypeId}" — it is not "Not set"`,
    );
    this.name = 'AllocationAlreadyAssignedError';
  }
}
