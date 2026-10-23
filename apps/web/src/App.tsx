import type { AuthHeaders } from './api/client.js';
import { SegmentsSettingsPage } from './features/segments-settings/SegmentsSettingsPage.js';

/**
 * Stand-in session, same pattern as apps/api/src/auth/context.ts: there is
 * no session or navigation shell yet (User Roles, overall app layout are
 * separate features). Replace this, not the feature components, once they
 * land.
 */
const DEMO_AUTH: AuthHeaders = {
  workspaceId: import.meta.env.VITE_DEMO_WORKSPACE_ID ?? '',
  role: import.meta.env.VITE_DEMO_ROLE ?? 'Admin',
};

export function App() {
  return <SegmentsSettingsPage auth={DEMO_AUTH} />;
}
