// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthHeaders } from '../../api/client.js';
import { SegmentsSetupStep } from './SegmentsSetupStep.js';

const auth: AuthHeaders = { workspaceId: 'ws-1', role: 'Admin' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SegmentsSetupStep', () => {
  it('[AC-SEG-001.3] refuses to finish setup with no segment type and asks for at least one', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if (method === 'GET') {
        return { ok: true, status: 200, json: async () => [] };
      }
      // POST /setup/complete
      return {
        ok: false,
        status: 422,
        json: async () => ({
          error: 'no_segment_type',
          message: 'At least one segment type is required to finish setup',
        }),
      };
    }) as unknown as typeof fetch;

    render(<SegmentsSetupStep auth={auth} onComplete={() => {}} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'At least one segment type is required to finish setup',
    );
  });

  it('[AC-SEG-001.2] a value added to a type appears listed under it', async () => {
    let types: Array<{ id: string; name: string; values: unknown[] }> = [];
    globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      const path = String(url);
      if (method === 'GET') {
        return { ok: true, status: 200, json: async () => types };
      }
      if (path.endsWith('/segment-types')) {
        types = [{ id: 'type-1', name: 'Region', values: [] }];
        return { ok: true, status: 201, json: async () => types[0] };
      }
      if (path.includes('/values')) {
        const value = { id: 'value-1', segmentTypeId: 'type-1', name: 'EMEA', archivedAt: null };
        types = types.map((t) => (t.id === 'type-1' ? { ...t, values: [value] } : t));
        return { ok: true, status: 201, json: async () => value };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch;

    render(<SegmentsSetupStep auth={auth} onComplete={() => {}} />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('e.g. Region'), 'Region');
    await user.click(screen.getByRole('button', { name: 'Add segment type' }));
    await waitFor(() => expect(screen.getByText('Region')).toBeInTheDocument());

    await user.type(screen.getByLabelText('New value for Region'), 'EMEA');
    await user.click(screen.getByRole('button', { name: 'Add value' }));

    expect(await screen.findByText('EMEA')).toBeInTheDocument();
  });

  it('[AC-SEG-001.4] shows the duplicate-name refusal when adding a segment type', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if (method === 'GET') {
        return { ok: true, status: 200, json: async () => [] };
      }
      return {
        ok: false,
        status: 409,
        json: async () => ({
          error: 'duplicate_name',
          message: 'A segment type named "Region" already exists',
        }),
      };
    }) as unknown as typeof fetch;

    render(<SegmentsSetupStep auth={auth} onComplete={() => {}} />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('e.g. Region'), 'Region');
    await user.click(screen.getByRole('button', { name: 'Add segment type' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A segment type named "Region" already exists',
    );
  });
});
