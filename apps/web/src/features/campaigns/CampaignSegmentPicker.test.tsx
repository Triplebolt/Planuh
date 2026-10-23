// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthHeaders } from '../../api/client.js';
import { CampaignSegmentPicker } from './CampaignSegmentPicker.js';

const auth: AuthHeaders = { workspaceId: 'ws-1', role: 'Manager' };

const TYPES = [
  {
    id: 'type-1',
    name: 'Region',
    values: [{ id: 'value-1', segmentTypeId: 'type-1', name: 'EMEA', archivedAt: null }],
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CampaignSegmentPicker', () => {
  it('[AC-SEG-003.5] picking a value replaces "Not set" on the campaign', async () => {
    const patchCalls: unknown[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if (method === 'GET') {
        return { ok: true, status: 200, json: async () => TYPES };
      }
      patchCalls.push(JSON.parse((init as RequestInit).body as string));
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const onSet = vi.fn();
    render(
      <CampaignSegmentPicker
        auth={auth}
        campaignId="campaign-1"
        segmentTypeId="type-1"
        segmentTypeName="Region"
        currentValueId={null}
        onSet={onSet}
      />,
    );

    expect(screen.getByText('Not set')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole('combobox'), 'EMEA');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSet).toHaveBeenCalled());
    expect(patchCalls).toEqual([{ segmentTypeId: 'type-1', segmentValueId: 'value-1' }]);
  });

  it('surfaces the refusal when the chosen value is archived', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if (method === 'GET') {
        return { ok: true, status: 200, json: async () => TYPES };
      }
      return {
        ok: false,
        status: 422,
        json: async () => ({
          error: 'archived_segment_value',
          message: '"EMEA" is archived and cannot be assigned',
        }),
      };
    }) as unknown as typeof fetch;

    render(
      <CampaignSegmentPicker
        auth={auth}
        campaignId="campaign-1"
        segmentTypeId="type-1"
        segmentTypeName="Region"
        currentValueId={null}
        onSet={() => {}}
      />,
    );

    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole('combobox'), 'EMEA');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'is archived and cannot be assigned',
    );
  });
});
