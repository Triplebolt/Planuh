/**
 * Minimal fetch wrapper. Auth is the stand-in header pair from
 * apps/api/src/auth/context.ts (User Roles hasn't landed yet) — replace this
 * file, not its call sites, once real sessions exist.
 */
export interface AuthHeaders {
  workspaceId: string;
  role: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.message === 'string' ? body.message : `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export async function apiRequest<T>(
  auth: AuthHeaders,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-workspace-id': auth.workspaceId,
      'x-user-role': auth.role,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(response.status, payload);
  }
  return payload as T;
}
