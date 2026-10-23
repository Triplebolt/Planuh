import { useEffect, useState } from 'react';
import type { AuthHeaders } from '../api/client.js';
import { listSegmentTypes, type SegmentValue } from '../api/segments.js';

export interface SegmentValuePickerProps {
  auth: AuthHeaders;
  segmentTypeId: string;
  value: string | null;
  onChange: (segmentValueId: string | null) => void;
  label?: string;
  /** Include archived values (existing allocations and campaigns keep them, AC-SEG-002.4). */
  includeArchived?: boolean;
}

/**
 * The shared picker every feature's form uses to offer a segment type's
 * values (AC-SEG-001.2) — nobody else queries values on its own. By default
 * it excludes archived values, since they stop being offered for new
 * assignments while staying on existing ones (AC-SEG-002.4).
 */
export function SegmentValuePicker({
  auth,
  segmentTypeId,
  value,
  onChange,
  label,
  includeArchived = false,
}: SegmentValuePickerProps) {
  const [values, setValues] = useState<SegmentValue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSegmentTypes(auth).then((types) => {
      if (cancelled) return;
      const type = types.find((t) => t.id === segmentTypeId);
      setValues(type?.values ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [auth, segmentTypeId]);

  const options = includeArchived ? values : values.filter((v) => v.archivedAt === null);

  return (
    <label className="pl-field">
      {label !== undefined ? <span className="pl-field-label">{label}</span> : null}
      <select
        className="pl-select"
        value={value ?? ''}
        disabled={loading}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">Select a value…</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
