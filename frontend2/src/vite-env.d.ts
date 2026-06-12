/// <reference types="vite/client" />

// Build-time env flags (Phase 05 Plan 04). VITE_AUTHELIA_ENABLED gates the
// Authelia SSO button on the login/register surfaces; the SPA reads the literal
// string "true" (Vite injects env vars as strings).
interface ImportMetaEnv {
  readonly VITE_AUTHELIA_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
