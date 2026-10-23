// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthHeaders } from '../api/client.js';
import { SegmentValuePicker } from './SegmentValuePicker.js';

const auth: AuthHeaders = { workspaceId: 'ws-1', role: 'Admin' };

function mockSegmentTypesResponse(types: unknown[]) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => types,
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SegmentValuePicker', () => {
  it('[AC-SEG-001.2] offers a value added to the type wherever the type is chosen', async () => {
    mockSegmentTypesResponse([
      {
        id: 'type-1',
        name: 'Region',
        values: [{ id: 'value-1', segmentTypeId: 'type-1', name: 'EMEA', archivedAt: null }],
      },
    ]);

    render(
      <SegmentValuePicker auth={auth} segmentTypeId="type-1" value={null} onChange={() => {}} />,
    );

    await waitFor(() => expect(screen.getByRole('option', { name: 'EMEA' })).toBeInTheDocument());
  });

  it('[AC-SEG-002.4] excludes archived values by default', async () => {
    mockSegmentTypesResponse([
      {
        id: 'type-1',
        name: 'Region',
        values: [
          { id: 'value-1', segmentTypeId: 'type-1', name: 'EMEA', archivedAt: null },
          {
            id: 'value-2',
            segmentTypeId: 'type-1',
            name: 'Legacy',
            archivedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    ]);

    render(
      <SegmentValuePicker auth={auth} segmentTypeId="type-1" value={null} onChange={() => {}} />,
    );

    await waitFor(() => expect(screen.getByRole('option', { name: 'EMEA' })).toBeInTheDocument());
    expect(screen.queryByRole('option', { name: 'Legacy' })).not.toBeInTheDocument();
  });

  it('includes archived values when includeArchived is set, so existing assignments keep showing theirs', async () => {
    mockSegmentTypesResponse([
      {
        id: 'type-1',
        name: 'Region',
        values: [
          {
            id: 'value-2',
            segmentTypeId: 'type-1',
            name: 'Legacy',
            archivedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    ]);

    render(
      <SegmentValuePicker
        auth={auth}
        segmentTypeId="type-1"
        value={null}
        onChange={() => {}}
        includeArchived
      />,
    );

    await waitFor(() => expect(screen.getByRole('option', { name: 'Legacy' })).toBeInTheDocument());
  });
});
