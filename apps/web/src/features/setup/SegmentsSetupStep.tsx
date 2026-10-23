import { useEffect, useState } from 'react';
import type { AuthHeaders } from '../../api/client.js';
import { ApiError } from '../../api/client.js';
import {
  completeSetup,
  createSegmentType,
  createSegmentValue,
  listSegmentTypes,
  type SegmentType,
} from '../../api/segments.js';

export interface SegmentsSetupStepProps {
  auth: AuthHeaders;
  onComplete: () => void;
}

/**
 * The segments step of workspace setup (REQ-SEG-001). Finishing refuses with
 * no segment type (AC-SEG-001.3); every value added here is immediately
 * offered through SegmentValuePicker everywhere the type is chosen
 * (AC-SEG-001.2).
 */
export function SegmentsSetupStep({ auth, onComplete }: SegmentsSetupStepProps) {
  const [types, setTypes] = useState<SegmentType[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newValueNames, setNewValueNames] = useState<Record<string, string>>({});
  const [finishError, setFinishError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setTypes(await listSegmentTypes(auth));
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh only on mount, re-runs explicitly after each write
  useEffect(() => {
    refresh();
  }, []);

  async function handleAddType(event: React.FormEvent) {
    event.preventDefault();
    if (newTypeName.trim() === '') return;
    await createSegmentType(auth, newTypeName.trim());
    setNewTypeName('');
    await refresh();
  }

  async function handleAddValue(typeId: string, event: React.FormEvent) {
    event.preventDefault();
    const name = (newValueNames[typeId] ?? '').trim();
    if (name === '') return;
    await createSegmentValue(auth, typeId, name);
    setNewValueNames((prev) => ({ ...prev, [typeId]: '' }));
    await refresh();
  }

  async function handleFinish() {
    setSubmitting(true);
    setFinishError(null);
    try {
      await completeSetup(auth);
      onComplete();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setFinishError(error.message);
      } else {
        throw error;
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="segments-step-heading">
      <h2 id="segments-step-heading">Segments</h2>
      <p>Define how spend will be grouped — e.g. by region, brand or channel.</p>

      <form onSubmit={handleAddType}>
        <label className="pl-field">
          <span className="pl-field-label">New segment type</span>
          <input
            className="pl-input"
            value={newTypeName}
            onChange={(event) => setNewTypeName(event.target.value)}
            placeholder="e.g. Region"
          />
        </label>
        <button type="submit" className="pl-btn pl-btn-secondary">
          Add segment type
        </button>
      </form>

      <ul aria-label="Segment types">
        {types.map((type) => (
          <li key={type.id}>
            <h3>{type.name}</h3>
            <ul aria-label={`${type.name} values`}>
              {type.values.map((value) => (
                <li key={value.id}>{value.name}</li>
              ))}
            </ul>
            <form onSubmit={(event) => handleAddValue(type.id, event)}>
              <label className="pl-field">
                <span className="pl-field-label">New value for {type.name}</span>
                <input
                  className="pl-input"
                  value={newValueNames[type.id] ?? ''}
                  onChange={(event) =>
                    setNewValueNames((prev) => ({ ...prev, [type.id]: event.target.value }))
                  }
                />
              </label>
              <button type="submit" className="pl-btn pl-btn-secondary">
                Add value
              </button>
            </form>
          </li>
        ))}
      </ul>

      {finishError !== null ? (
        <p role="alert" className="pl-hint-error">
          {finishError}
        </p>
      ) : null}

      <button
        type="button"
        className="pl-btn pl-btn-primary"
        disabled={submitting}
        onClick={handleFinish}
      >
        Finish setup
      </button>
    </section>
  );
}
