/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DEMO_WORKSPACE_ID?: string;
  readonly VITE_DEMO_ROLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
