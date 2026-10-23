import { useState } from 'react';
import type { AuthHeaders } from '../../api/client.js';
import { ApiError } from '../../api/client.js';
import { setCampaignSegmentValue } from '../../api/segments.js';
import { SegmentValuePicker } from '../../components/SegmentValuePicker.js';

export interface CampaignSegmentPickerProps {
  auth: AuthHeaders;
  campaignId: string;
  segmentTypeId: string;
  segmentTypeName: string;
  /** null while the campaign sits under "Not set" for this type. */
  currentValueId: string | null;
  onSet: () => void;
}

/**
 * Lets a user who may edit a campaign pick its value for a segment type
 * added after budget existed, replacing "Not set" (AC-SEG-003.5). Archived
 * values are refused by the server and surfaced here.
 */
export function CampaignSegmentPicker({
  auth,
  campaignId,
  segmentTypeId,
  segmentTypeName,
  currentValueId,
  onSet,
}: CampaignSegmentPickerProps) {
  const [selected, setSelected] = useState<string | null>(currentValueId);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (selected === null) return;
    setError(null);
    try {
      await setCampaignSegmentValue(auth, campaignId, segmentTypeId, selected);
      onSet();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError(err.message);
      } else {
        throw err;
      }
    }
  }

  return (
    <div>
      <SegmentValuePicker
        auth={auth}
        segmentTypeId={segmentTypeId}
        value={selected}
        onChange={setSelected}
        label={segmentTypeName}
      />
      {currentValueId === null ? <span className="pl-badge">Not set</span> : null}
      {error !== null ? (
        <p role="alert" className="pl-hint-error">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="pl-btn pl-btn-primary"
        disabled={selected === null || selected === currentValueId}
        onClick={handleSave}
      >
        Save
      </button>
    </div>
  );
}
