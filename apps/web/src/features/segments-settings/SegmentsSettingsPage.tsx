import { useEffect, useState } from 'react';
import type { AuthHeaders } from '../../api/client.js';
import { ApiError } from '../../api/client.js';
import {
  archiveSegmentValue,
  createSegmentType,
  createSegmentValue,
  deleteSegmentType,
  deleteSegmentValue,
  listSegmentTypes,
  renameSegmentValue,
  type SegmentType,
} from '../../api/segments.js';

export interface SegmentsSettingsPageProps {
  auth: AuthHeaders;
}

interface RowError {
  message: string;
  canArchive: boolean;
}

/**
 * Admin-only Segments settings page (REQ-SEG-002): add, rename, archive and
 * delete values, and the removal guard for a type once the plan holds
 * budget (AC-SEG-003.7, DEC-SEG-01).
 */
export function SegmentsSettingsPage({ auth }: SegmentsSettingsPageProps) {
  const [types, setTypes] = useState<SegmentType[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newValueNames, setNewValueNames] = useState<Record<string, string>>({});
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [valueErrors, setValueErrors] = useState<Record<string, RowError>>({});
  const [typeErrors, setTypeErrors] = useState<Record<string, string>>({});

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

  async function handleRename(valueId: string) {
    const name = renameDrafts[valueId];
    if (name === undefined || name.trim() === '') return;
    await renameSegmentValue(auth, valueId, name.trim());
    await refresh();
  }

  async function handleArchive(valueId: string) {
    await archiveSegmentValue(auth, valueId);
    await refresh();
  }

  async function handleDelete(valueId: string) {
    try {
      await deleteSegmentValue(auth, valueId);
      setValueErrors((prev) => {
        const next = { ...prev };
        delete next[valueId];
        return next;
      });
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setValueErrors((prev) => ({
          ...prev,
          [valueId]: { message: error.message, canArchive: Boolean(error.body.canArchive) },
        }));
        return;
      }
      throw error;
    }
  }

  async function handleRemoveType(typeId: string) {
    try {
      await deleteSegmentType(auth, typeId);
      setTypeErrors((prev) => {
        const next = { ...prev };
        delete next[typeId];
        return next;
      });
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setTypeErrors((prev) => ({ ...prev, [typeId]: error.message }));
        return;
      }
      throw error;
    }
  }

  return (
    <section aria-labelledby="segments-settings-heading">
      <h1 id="segments-settings-heading">Segments</h1>

      <form onSubmit={handleAddType}>
        <label className="pl-field">
          <span className="pl-field-label">New segment type</span>
          <input
            className="pl-input"
            value={newTypeName}
            onChange={(event) => setNewTypeName(event.target.value)}
          />
        </label>
        <button type="submit" className="pl-btn pl-btn-secondary">
          Add segment type
        </button>
      </form>

      {types.map((type) => (
        <article key={type.id} aria-label={type.name}>
          <header>
            <h2>{type.name}</h2>
            <button
              type="button"
              className="pl-btn pl-btn-danger"
              onClick={() => handleRemoveType(type.id)}
            >
              Remove type
            </button>
            {typeErrors[type.id] !== undefined ? (
              <p role="alert" className="pl-hint-error">
                {typeErrors[type.id]}
              </p>
            ) : null}
          </header>

          <table className="pl-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {type.values.map((value) => (
                <tr key={value.id}>
                  <td>
                    <input
                      className="pl-input"
                      aria-label={`Rename ${value.name}`}
                      value={renameDrafts[value.id] ?? value.name}
                      onChange={(event) =>
                        setRenameDrafts((prev) => ({ ...prev, [value.id]: event.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="pl-btn pl-btn-secondary"
                      onClick={() => handleRename(value.id)}
                    >
                      Save name
                    </button>
                  </td>
                  <td>{value.archivedAt !== null ? 'Archived' : 'Active'}</td>
                  <td>
                    {value.archivedAt === null ? (
                      <button
                        type="button"
                        className="pl-btn pl-btn-secondary"
                        onClick={() => handleArchive(value.id)}
                      >
                        Archive
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="pl-btn pl-btn-danger"
                      onClick={() => handleDelete(value.id)}
                    >
                      Delete
                    </button>
                    {valueErrors[value.id] !== undefined ? (
                      <p role="alert" className="pl-hint-error">
                        {valueErrors[value.id]?.message}
                        {valueErrors[value.id]?.canArchive === true ? (
                          <button
                            type="button"
                            className="pl-btn pl-btn-secondary"
                            onClick={() => handleArchive(value.id)}
                          >
                            Archive instead
                          </button>
                        ) : null}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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
        </article>
      ))}
    </section>
  );
}
