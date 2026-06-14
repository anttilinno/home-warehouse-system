// Phase 7 Plan 01 — photo URL rewrite at the API mapper boundary.
//
// The backend emits photo URLs as ABSOLUTE `http://localhost:8080/workspaces/...`
// (built from cfg.BackendURL — 07-RESEARCH Pitfall 1). Those bypass the Vite
// `/api` proxy and the same-origin cookie, so every absolute backend URL MUST be
// rewritten to a relative `/api/...` path before any <img> consumer sees it.
//
// Open-redirect guard (threat T-07-01): only `u.pathname + u.search` survive —
// scheme AND host are DROPPED. An attacker-controlled host in the input can
// therefore never be reached: the result ALWAYS begins `/api/`. On parse failure
// (the input is already relative) the input is returned unchanged.
export function toProxyUrl(absolute: string): string {
  try {
    const u = new URL(absolute);
    return `/api${u.pathname}${u.search}`;
  } catch {
    return absolute;
  }
}
