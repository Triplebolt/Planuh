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
