import type { Role } from './context.js';

export class ForbiddenError extends Error {
  constructor(allowed: readonly Role[]) {
    super(`requires one of: ${allowed.join(', ')}`);
    this.name = 'ForbiddenError';
  }
}

export function requireRole(role: Role, allowed: readonly Role[]): void {
  if (!allowed.includes(role)) {
    throw new ForbiddenError(allowed);
  }
}
