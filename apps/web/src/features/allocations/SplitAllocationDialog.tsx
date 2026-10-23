import { useState } from 'react';
import type { AuthHeaders } from '../../api/client.js';
import { ApiError } from '../../api/client.js';
import { splitAllocation } from '../../api/segments.js';
import { SegmentValuePicker } from '../../components/SegmentValuePicker.js';

export interface SplitAllocationDialogProps {
  auth: AuthHeaders;
  allocationId: string;
  segmentTypeId: string;
  /** The allocation's current "Not set" amount for this segment type, in minor units. */
  notSetAmountMinorUnits: string;
  onSplit: () => void;
  onCancel: () => void;
}

interface Part {
  segmentValueId: string | null;
  amount: string;
}

/**
 * Splits an allocation's "Not set" amount across values of the segment type
 * that was added after budget existed (AC-SEG-003.4). The server is the
 * source of truth for the balance rule (AC-SEG-003.6); this only disables
 * submit early so a user isn't surprised by the refusal.
 */
export function SplitAllocationDialog({
  auth,
  allocationId,
  segmentTypeId,
  notSetAmountMinorUnits,
  onSplit,
  onCancel,
}: SplitAllocationDialogProps) {
  const [parts, setParts] = useState<Part[]>([
    { segmentValueId: null, amount: '' },
    { segmentValueId: null, amount: '' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function parseAmount(raw: string): bigint {
    return /^-?\d+$/.test(raw) ? BigInt(raw) : 0n;
  }

  const total = parts.reduce((sum, part) => sum + parseAmount(part.amount), 0n);
  const balanced = total === BigInt(notSetAmountMinorUnits);

  function updatePart(index: number, patch: Partial<Part>) {
    setParts((prev) => prev.map((part, i) => (i === index ? { ...part, ...patch } : part)));
  }

  function addPart() {
    setParts((prev) => [...prev, { segmentValueId: null, amount: '' }]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await splitAllocation(
        auth,
        allocationId,
        segmentTypeId,
        parts
          .filter((part): part is Part & { segmentValueId: string } => part.segmentValueId !== null)
          .map((part) => ({ segmentValueId: part.segmentValueId, amountMinorUnits: part.amount })),
      );
      onSplit();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError(err.message);
      } else {
        throw err;
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div role="dialog" aria-labelledby="split-allocation-heading" className="pl-dialog">
      <h2 id="split-allocation-heading">Split "Not set" amount</h2>
      <form onSubmit={handleSubmit}>
        {parts.map((part, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts have no stable id until submitted
          <div key={index}>
            <SegmentValuePicker
              auth={auth}
              segmentTypeId={segmentTypeId}
              value={part.segmentValueId}
              onChange={(value) => updatePart(index, { segmentValueId: value })}
              label={`Value ${index + 1}`}
            />
            <label className="pl-field">
              <span className="pl-field-label">Amount</span>
              <input
                className="pl-input"
                inputMode="numeric"
                value={part.amount}
                onChange={(event) => updatePart(index, { amount: event.target.value })}
              />
            </label>
          </div>
        ))}
        <button type="button" className="pl-btn pl-btn-secondary" onClick={addPart}>
          Add another value
        </button>

        {!balanced ? (
          <p className="pl-hint">
            Parts must sum to {notSetAmountMinorUnits} (currently {total.toString()}).
          </p>
        ) : null}
        {error !== null ? (
          <p role="alert" className="pl-hint-error">
            {error}
          </p>
        ) : null}

        <button type="submit" className="pl-btn pl-btn-primary" disabled={!balanced || submitting}>
          Split
        </button>
        <button type="button" className="pl-btn pl-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </form>
    </div>
  );
}
