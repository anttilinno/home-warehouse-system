import { test, expect, type Page } from "@playwright/test";

// Phase 5 auth E2E (AUTH-02 / AUTH-06 / AUTH-12). The browser-level regression
// guards the unit/integration layers cannot reach, run against the live stack
// per the CLAUDE.md §E2E runbook (backend :8080 + Postgres warehouse_dev + Vite
// :5173; no webServer auto-launch). These complement Plan 01's Go integration
// test: Plan 01 proves logout revokes at the Go/Postgres layer; this proves it
// through the real cookie-JWT browser round-trip.
//
// Exact-match submit discipline (CLAUDE.md): the v3.0 /login page now hosts the
// OAuth buttons ("Sign in with Google/GitHub/SSO"), so the primary submit MUST
// be selected with /^log in$/i to resolve uniquely. After login the access_token
// cookie is inherited by BOTH the page context AND page.request — additional API
// calls need no manual token plumbing.

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

// Shared seeder login. Exact-match submit (multi-button login page).
async function loginAsSeeder(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL("/");
}

// AUTH-02 — a real register flow creates a UNIQUE-email account against the live
// stack and lands authenticated on the dashboard. The unique timestamp suffix
// keeps the test idempotent across runs (no cross-run email collision); the
// backend has no delete endpoint requirement, so cleanup is best-effort/omitted.
test("register creates a unique account and lands on the dashboard", async ({
  page,
}) => {
  const uniqueEmail = `e2e+${Date.now()}@test.local`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("E2E Register");
  await page.getByLabel("Email").fill(uniqueEmail);
  // Password >= 8 chars (registerSchema min(8)); confirm must match.
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: /create account/i }).click();

  // Lands on the dashboard with the same authenticated marker the login spec
  // asserts (the Items stat window renders once /analytics/dashboard resolves).
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: /^items$/i })).toBeVisible();
});

// AUTH-06 — the workspace switcher is visible and interactive in the live
// authenticated shell. The seeder may have a single workspace, in which case
// the pill is a non-expanding label (aria-disabled, no listbox) by design; with
// multiple workspaces it is a listbox trigger. To stay deterministic we assert
// PRESENCE + openability, not an actual switch.
test("workspace switcher is visible and interactive in the shell", async ({
  page,
}) => {
  await loginAsSeeder(page);

  const pill = page.getByTestId("workspace-pill");
  await expect(pill).toBeVisible();

  const haspopup = await pill.getAttribute("aria-haspopup");
  if (haspopup === "listbox") {
    // Multi-workspace: the trigger is an interactive listbox button — open it
    // and assert at least the current-workspace row renders.
    await expect(pill).not.toHaveAttribute("aria-disabled", "true");
    await pill.click();
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole("option").first()).toBeVisible();
  } else {
    // Single-workspace: the pill renders the current workspace name as a
    // non-expanding label (nothing to switch to). Presence is the guarantee.
    await expect(pill).toHaveAttribute("aria-disabled", "true");
    await expect(pill).not.toBeEmpty();
  }
});

// AUTH-12 end-to-end — logout actually revokes the session through the real
// cookie round-trip. The browser-layer complement to Plan 01's Go integration
// guard (matched-pair discipline, Phase 65 precedent): after logout the app
// lands on /login AND the old session cannot be reused for protected access.
test("logout revokes the session: protected access is denied afterward", async ({
  page,
}) => {
  await loginAsSeeder(page);

  // Sanity: while authenticated, a protected API call succeeds (page.request
  // inherits the access_token cookie — no manual token plumbing). /users/me is
  // behind JWTAuth; via the Vite /api → root rewrite it hits the backend root.
  const before = await page.request.get("/api/users/me");
  expect(before.status()).toBe(200);

  // Log out through the real UI: user pill → Log out menuitem → confirm dialog
  // → danger "Log out" button (this is the only path that POSTs /auth/logout
  // and revokes the session server-side; BAR-05 — ESC never logs out).
  await page.getByTestId("user-pill").click();
  await page.getByRole("menuitem", { name: /log out/i }).click();
  const dialog = page.getByRole("dialog", { name: /log out/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /log out/i }).click();

  // Post-logout the app lands on /login (the in-memory refresh token + cache
  // are cleared and RequireAuth redirects).
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();

  // The key revocation assertion: a fresh protected call is now denied. The
  // session was revoked server-side, so even if a stale access_token cookie
  // lingered, the refresh path (ErrSessionNotFound → 401, no new session) means
  // protected access fails. We assert the old session cannot be reused.
  const after = await page.request.get("/api/users/me", {
    failOnStatusCode: false,
  });
  expect(after.status()).toBe(401);

  // And navigating to an authenticated route bounces back to /login.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

// AUTH-03/04 — OAuth initiate flows. Skip-with-reason RECORDED (not silently
// absent) per the Phase 65 rebuild-the-wiped-spec discipline: live OAuth needs
// provider creds + APP_URL=:5173 which CI does not have (parity §7). The button
// rendering + callback exchange + error taxonomy are covered by MSW unit tests.
// NOTE: the skip is scoped INSIDE each test body (test.skip(condition, reason))
// so it marks only these two as skipped — a top-level test.skip(true, …) would
// skip the whole FILE, silencing the register/switcher/logout guards above.
const OAUTH_SKIP_REASON =
  "OAuth requires provider creds + APP_URL=:5173; skipped in CI per parity §7 — covered by MSW unit tests";

test("Google OAuth initiate redirects to the provider", async ({ page }) => {
  test.skip(true, OAUTH_SKIP_REASON);
  await page.goto("/login");
  await page.getByRole("button", { name: /sign in with google/i }).click();
  // Would assert a redirect to accounts.google.com — needs live provider creds.
});

test("GitHub OAuth initiate redirects to the provider", async ({ page }) => {
  test.skip(true, OAUTH_SKIP_REASON);
  await page.goto("/login");
  await page.getByRole("button", { name: /sign in with github/i }).click();
  // Would assert a redirect to github.com/login/oauth — needs live provider creds.
});
