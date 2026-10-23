/**
 * Stand-in for the real auth/session layer: User Roles (role definitions,
 * Cognito-backed sign-in) is a separate feature and hasn't been built in
 * this round. Every segment-changing route still needs a role to check
 * against (AC-SEG-001.5), so this reads two headers set by whatever sits in
 * front of the API today — a test harness now, Cognito-backed session
 * middleware once User Roles lands. Replace this file, not its call sites.
 */
export type Role = 'Admin' | 'Manager' | 'CMO' | 'Executor';

export interface AuthContext {
  workspaceId: string;
  role: Role;
}

export class MissingAuthContextError extends Error {
  constructor() {
    super('x-workspace-id and x-user-role headers are required');
    this.name = 'MissingAuthContextError';
  }
}

const ROLES: readonly Role[] = ['Admin', 'Manager', 'CMO', 'Executor'];

export function readAuthContext(headers: Record<string, unknown>): AuthContext {
  const workspaceId = headers['x-workspace-id'];
  const role = headers['x-user-role'];
  if (
    typeof workspaceId !== 'string' ||
    typeof role !== 'string' ||
    !ROLES.includes(role as Role)
  ) {
    throw new MissingAuthContextError();
  }
  return { workspaceId, role: role as Role };
}
