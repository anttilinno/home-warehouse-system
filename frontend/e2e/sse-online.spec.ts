import { test, expect } from "@playwright/test";

// Phase 6 SSE live-stack smoke (PROV-01/PROV-02). After a real /login the
// SSEProvider (mounted under WorkspaceProvider in AppShell) opens one
// EventSource to /api/workspaces/{wsId}/sse; once the backend emits its initial
// `connected` event the TopBar chrome flips to the connected state. This guards
// the end-to-end wiring against the running backend + Postgres per the
// CLAUDE.md §E2E runbook. Full e2e runs at the orchestrator phase gate (this
// needs the live stack up); the in-plan gate only confirms the spec is collected.

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

test("after login the TopBar SSE chrome reaches the connected state", async ({
  page,
}) => {
  // Already authenticated by the `setup` project via storageState, so this
  // returns immediately in a normal run. It only performs a real login when
  // the saved state is missing (running one spec with e2e/.auth deleted).
  // Logging in per spec is what pushed the suite over the 20/min limiter.
  await page.goto("/");
  if (new URL(page.url()).pathname === "/login") {
    await page.getByLabel("Email").fill(E2E_USER);
    await page.getByLabel("Password").fill(E2E_PASS);
    await page.getByRole("button", { name: /^log in$/i }).click();
    await expect(page).toHaveURL("/");
  }
  // Wait for the authenticated shell to actually mount. `goto` resolves on
  // load, which is earlier than the old login flow settled — specs that
  // immediately press a keyboard chord raced the app attaching its handlers.
  await expect(page.getByTestId("workspace-pill")).toBeVisible();

  // The ONLINE dot label flips to ONLINE once useSSEStatus().connected is true
  // (the dot binds to the live stream — Phase 6). Give the EventSource a moment
  // to open + receive its first `connected` event against the live backend.
  await expect(page.getByText("ONLINE")).toBeVisible({ timeout: 15_000 });

  // The sse-slot RetroStatusDot mirrors the same state: its `live` word renders
  // (md+ viewport — the slot is hidden below 768px; Playwright's default desktop
  // viewport is ≥768px so the md:inline-flex slot is shown).
  const sseSlot = page.getByTestId("sse-slot");
  await expect(sseSlot.getByText("live")).toBeVisible({ timeout: 15_000 });
});
