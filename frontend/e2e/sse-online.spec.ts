import { test, expect } from "@playwright/test";

// Phase 6 SSE live-stack smoke (PROV-01/PROV-02). After a real /login the
// SSEProvider (mounted under WorkspaceProvider in AppShell) opens one
// EventSource to /api/workspaces/{wsId}/sse. The TopBar no longer shows a
// separate SSE dot (the ONLINE pill reports network state, ux/simplify-flows),
// so the spec asserts the stream itself: the authenticated EventSource request
// is answered 200 as text/event-stream by the running backend + Postgres per
// the CLAUDE.md §E2E runbook. Full e2e runs at the orchestrator phase gate (this
// needs the live stack up); the in-plan gate only confirms the spec is collected.

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

test("after login the shell opens the workspace SSE stream", async ({
  page,
}) => {
  // Registered before navigation: the EventSource opens as the shell mounts.
  const sse = page.waitForResponse(
    (res) => /\/api\/workspaces\/[^/]+\/sse/.test(res.url()),
    { timeout: 15_000 },
  );
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

  // The stream is authenticated (cookie JWT) and workspace-scoped; a 401/404
  // here means the shell lost its SSE wiring.
  const res = await sse;
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/event-stream");

  // Network-state pill (useIsOnline) still renders in the TopBar.
  await expect(page.getByText("ONLINE")).toBeVisible();
});
