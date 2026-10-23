// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthHeaders } from '../../api/client.js';
import { SplitAllocationDialog } from './SplitAllocationDialog.js';

const auth: AuthHeaders = { workspaceId: 'ws-1', role: 'Admin' };

const TYPES = [
  {
    id: 'type-1',
    name: 'Region',
    values: [
      { id: 'value-1', segmentTypeId: 'type-1', name: 'EMEA', archivedAt: null },
      { id: 'value-2', segmentTypeId: 'type-1', name: 'APAC', archivedAt: null },
    ],
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SplitAllocationDialog', () => {
  it('[AC-SEG-003.4] splits a "Not set" amount across values that sum to it', async () => {
    const splitCalls: unknown[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if (method === 'GET') {
        return { ok: true, status: 200, json: async () => TYPES };
      }
      splitCalls.push(JSON.parse((init as RequestInit).body as string));
      return { ok: true, status: 200, json: async () => [] };
    }) as unknown as typeof fetch;

    const onSplit = vi.fn();
    render(
      <SplitAllocationDialog
        auth={auth}
        allocationId="alloc-1"
        segmentTypeId="type-1"
        notSetAmountMinorUnits="10000"
        onSplit={onSplit}
        onCancel={() => {}}
      />,
    );

    const pickers = await screen.findAllByRole('combobox');
    const user = userEvent.setup();
    await user.selectOptions(pickers[0] as HTMLSelectElement, 'EMEA');
    await user.selectOptions(pickers[1] as HTMLSelectElement, 'APAC');

    const amounts = screen.getAllByLabelText('Amount');
    await user.type(amounts[0] as HTMLElement, '6000');
    await user.type(amounts[1] as HTMLElement, '4000');

    await user.click(screen.getByRole('button', { name: 'Split' }));

    await waitFor(() => expect(onSplit).toHaveBeenCalled());
    expect(splitCalls).toEqual([
      {
        segmentTypeId: 'type-1',
        parts: [
          { segmentValueId: 'value-1', amountMinorUnits: '6000' },
          { segmentValueId: 'value-2', amountMinorUnits: '4000' },
        ],
      },
    ]);
  });

  it('[AC-SEG-003.6] keeps the split disabled while the parts do not sum to the "Not set" amount', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => TYPES,
    }) as unknown as typeof fetch;

    render(
      <SplitAllocationDialog
        auth={auth}
        allocationId="alloc-1"
        segmentTypeId="type-1"
        notSetAmountMinorUnits="10000"
        onSplit={() => {}}
        onCancel={() => {}}
      />,
    );

    const user = userEvent.setup();
    const amounts = await screen.findAllByLabelText('Amount');
    await user.type(amounts[0] as HTMLElement, '6000');
    await user.type(amounts[1] as HTMLElement, '3000');

    expect(screen.getByRole('button', { name: 'Split' })).toBeDisabled();
    expect(screen.getByText(/Parts must sum to 10000/)).toBeInTheDocument();
  });

  it('[AC-SEG-003.6] surfaces the server refusal when amounts do not equal the "Not set" amount', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if (method === 'GET') {
        return { ok: true, status: 200, json: async () => TYPES };
      }
      return {
        ok: false,
        status: 422,
        json: async () => ({
          error: 'split_amount_mismatch',
          message: 'Split amounts (9000) must equal the "Not set" amount (10000)',
        }),
      };
    }) as unknown as typeof fetch;

    render(
      <SplitAllocationDialog
        auth={auth}
        allocationId="alloc-1"
        segmentTypeId="type-1"
        notSetAmountMinorUnits="10000"
        onSplit={() => {}}
        onCancel={() => {}}
      />,
    );

    const pickers = await screen.findAllByRole('combobox');
    const user = userEvent.setup();
    await user.selectOptions(pickers[0] as HTMLSelectElement, 'EMEA');
    await user.selectOptions(pickers[1] as HTMLSelectElement, 'APAC');
    const amounts = screen.getAllByLabelText('Amount');
    // Client-side total matches so the button is enabled, but the server
    // still disagrees (e.g. a concurrent change) and must be obeyed.
    await user.type(amounts[0] as HTMLElement, '6000');
    await user.type(amounts[1] as HTMLElement, '4000');
    await user.click(screen.getByRole('button', { name: 'Split' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Split amounts (9000) must equal the "Not set" amount (10000)',
    );
  });
});
