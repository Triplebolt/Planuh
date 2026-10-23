// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthHeaders } from '../../api/client.js';
import { SegmentsSettingsPage } from './SegmentsSettingsPage.js';

const auth: AuthHeaders = { workspaceId: 'ws-1', role: 'Admin' };

afterEach(() => {
  vi.restoreAllMocks();
});

interface Value {
  id: string;
  segmentTypeId: string;
  name: string;
  archivedAt: string | null;
}
interface Type {
  id: string;
  name: string;
  values: Value[];
}

function setUpFetch(initial: Type[], options: { valueInUse?: string; typeInUse?: string } = {}) {
  let types = initial;

  globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
    const method = (init as RequestInit | undefined)?.method ?? 'GET';
    const path = String(url);

    if (method === 'GET' && path.endsWith('/segment-types')) {
      return { ok: true, status: 200, json: async () => types };
    }
    if (method === 'POST' && path.endsWith('/segment-types')) {
      const body = JSON.parse((init as RequestInit).body as string) as { name: string };
      const type: Type = { id: `type-${types.length + 1}`, name: body.name, values: [] };
      types = [...types, type];
      return { ok: true, status: 201, json: async () => type };
    }
    if (method === 'POST' && path.includes('/values')) {
      const typeId = path.split('/')[2];
      const body = JSON.parse((init as RequestInit).body as string) as { name: string };
      const value: Value = {
        id: `value-${Math.random()}`,
        segmentTypeId: typeId ?? '',
        name: body.name,
        archivedAt: null,
      };
      types = types.map((t) => (t.id === typeId ? { ...t, values: [...t.values, value] } : t));
      return { ok: true, status: 201, json: async () => value };
    }
    if (method === 'PATCH' && path.includes('/segment-values/')) {
      const id = path.split('/').pop();
      const body = JSON.parse((init as RequestInit).body as string) as { name: string };
      types = types.map((t) => ({
        ...t,
        values: t.values.map((v) => (v.id === id ? { ...v, name: body.name } : v)),
      }));
      return { ok: true, status: 200, json: async () => ({}) };
    }
    if (method === 'POST' && path.includes('/archive')) {
      const id = path.split('/')[2];
      types = types.map((t) => ({
        ...t,
        values: t.values.map((v) =>
          v.id === id ? { ...v, archivedAt: '2026-01-01T00:00:00.000Z' } : v,
        ),
      }));
      return { ok: true, status: 200, json: async () => ({}) };
    }
    if (method === 'DELETE' && path.includes('/segment-values/')) {
      const id = path.split('/').pop();
      if (id === options.valueInUse) {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            error: 'segment_value_in_use',
            canArchive: true,
            message: `"${id}" is used by an allocation or campaign and cannot be deleted`,
          }),
        };
      }
      types = types.map((t) => ({ ...t, values: t.values.filter((v) => v.id !== id) }));
      return { ok: true, status: 204, json: async () => undefined };
    }
    if (method === 'DELETE' && path.includes('/segment-types/')) {
      const id = path.split('/').pop();
      if (id === options.typeInUse) {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            error: 'segment_type_in_use',
            message: `"${id}" cannot be removed while the plan holds budget`,
          }),
        };
      }
      types = types.filter((t) => t.id !== id);
      return { ok: true, status: 204, json: async () => undefined };
    }
    throw new Error(`unhandled request ${method} ${path}`);
  }) as unknown as typeof fetch;
}

describe('SegmentsSettingsPage', () => {
  it('[AC-SEG-002.1] a value added after setup appears for new allocations', async () => {
    setUpFetch([{ id: 'type-1', name: 'Region', values: [] }]);
    render(<SegmentsSettingsPage auth={auth} />);
    const user = userEvent.setup();

    await screen.findByText('Region');
    await user.type(screen.getByLabelText('New value for Region'), 'EMEA');
    await user.click(screen.getByRole('button', { name: 'Add value' }));

    expect(await screen.findByLabelText('Rename EMEA')).toBeInTheDocument();
  });

  it('[AC-SEG-002.2] renaming a value shows the new name', async () => {
    setUpFetch([
      {
        id: 'type-1',
        name: 'Region',
        values: [{ id: 'value-1', segmentTypeId: 'type-1', name: 'EMEA', archivedAt: null }],
      },
    ]);
    render(<SegmentsSettingsPage auth={auth} />);
    const user = userEvent.setup();

    const input = await screen.findByLabelText('Rename EMEA');
    await user.clear(input);
    await user.type(input, 'Europe');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() => expect(screen.getByLabelText('Rename Europe')).toBeInTheDocument());
  });

  it('[AC-SEG-002.3] refuses to delete a value in use and offers to archive it instead', async () => {
    setUpFetch(
      [
        {
          id: 'type-1',
          name: 'Region',
          values: [{ id: 'value-1', segmentTypeId: 'type-1', name: 'EMEA', archivedAt: null }],
        },
      ],
      { valueInUse: 'value-1' },
    );
    render(<SegmentsSettingsPage auth={auth} />);
    const user = userEvent.setup();

    await screen.findByLabelText('Rename EMEA');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('cannot be deleted');
    expect(screen.getByRole('button', { name: 'Archive instead' })).toBeInTheDocument();
    expect(screen.getByLabelText('Rename EMEA')).toBeInTheDocument();
  });

  it('[AC-SEG-002.4] archiving stops a value being active while keeping it listed', async () => {
    setUpFetch([
      {
        id: 'type-1',
        name: 'Region',
        values: [{ id: 'value-1', segmentTypeId: 'type-1', name: 'EMEA', archivedAt: null }],
      },
    ]);
    render(<SegmentsSettingsPage auth={auth} />);
    const user = userEvent.setup();

    await screen.findByLabelText('Rename EMEA');
    await user.click(screen.getByRole('button', { name: 'Archive' }));

    const row = (await screen.findByText('Archived')).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByLabelText('Rename EMEA')).toBeInTheDocument();
  });

  it('[AC-SEG-002.5] deletes a value that nothing uses', async () => {
    setUpFetch([
      {
        id: 'type-1',
        name: 'Region',
        values: [{ id: 'value-1', segmentTypeId: 'type-1', name: 'EMEA', archivedAt: null }],
      },
    ]);
    render(<SegmentsSettingsPage auth={auth} />);
    const user = userEvent.setup();

    await screen.findByLabelText('Rename EMEA');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByLabelText('Rename EMEA')).not.toBeInTheDocument());
  });

  it('[AC-SEG-003.7] refuses to remove a segment type while the plan holds budget', async () => {
    setUpFetch([{ id: 'type-1', name: 'Region', values: [] }], { typeInUse: 'type-1' });
    render(<SegmentsSettingsPage auth={auth} />);
    const user = userEvent.setup();

    await screen.findByText('Region');
    await user.click(screen.getByRole('button', { name: 'Remove type' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'cannot be removed while the plan holds budget',
    );
    expect(screen.getByText('Region')).toBeInTheDocument();
  });
});
