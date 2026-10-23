import { type AuthHeaders, apiRequest } from './client.js';

export interface SegmentValue {
  id: string;
  segmentTypeId: string;
  name: string;
  archivedAt: string | null;
}

export interface SegmentType {
  id: string;
  name: string;
  values: SegmentValue[];
}

export function listSegmentTypes(auth: AuthHeaders): Promise<SegmentType[]> {
  return apiRequest(auth, 'GET', '/segment-types');
}

export function createSegmentType(auth: AuthHeaders, name: string): Promise<SegmentType> {
  return apiRequest(auth, 'POST', '/segment-types', { name });
}

export function createSegmentValue(
  auth: AuthHeaders,
  segmentTypeId: string,
  name: string,
): Promise<SegmentValue> {
  return apiRequest(auth, 'POST', `/segment-types/${segmentTypeId}/values`, { name });
}

export function renameSegmentValue(
  auth: AuthHeaders,
  segmentValueId: string,
  name: string,
): Promise<SegmentValue> {
  return apiRequest(auth, 'PATCH', `/segment-values/${segmentValueId}`, { name });
}

export function archiveSegmentValue(
  auth: AuthHeaders,
  segmentValueId: string,
): Promise<SegmentValue> {
  return apiRequest(auth, 'POST', `/segment-values/${segmentValueId}/archive`);
}

export function deleteSegmentValue(auth: AuthHeaders, segmentValueId: string): Promise<void> {
  return apiRequest(auth, 'DELETE', `/segment-values/${segmentValueId}`);
}

export function deleteSegmentType(auth: AuthHeaders, segmentTypeId: string): Promise<void> {
  return apiRequest(auth, 'DELETE', `/segment-types/${segmentTypeId}`);
}

export function completeSetup(auth: AuthHeaders): Promise<{ status: string }> {
  return apiRequest(auth, 'POST', '/setup/complete');
}

export interface SplitPart {
  segmentValueId: string;
  amountMinorUnits: string;
}

export function splitAllocation(
  auth: AuthHeaders,
  allocationId: string,
  segmentTypeId: string,
  parts: SplitPart[],
): Promise<unknown> {
  return apiRequest(auth, 'POST', `/allocations/${allocationId}/split`, {
    segmentTypeId,
    parts,
  });
}

export function setCampaignSegmentValue(
  auth: AuthHeaders,
  campaignId: string,
  segmentTypeId: string,
  segmentValueId: string,
): Promise<unknown> {
  return apiRequest(auth, 'PATCH', `/campaigns/${campaignId}/segments`, {
    segmentTypeId,
    segmentValueId,
  });
}
