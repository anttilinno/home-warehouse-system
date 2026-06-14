import { test, expect, type Page } from "@playwright/test";

// Phase 12 Plan 07 — live Settings-hub E2E (SETT-01 / SETT-02 / SETT-05 /
// SETT-10). Runs against the live dev stack per the CLAUDE.md §E2E runbook
// (backend :8080 + Postgres warehouse_dev + Vite :5173; no webServer
// auto-launch). This is the outer-loop parity proof the per-page MSW unit tests
// (Plans 12-03..12-06) cannot reach: it crosses the real cookie-JWT boundary and
// the load-bearing /api proxy rewrite (vite.config.ts) end to end.
//
// ONE LOGIN, ONE SPEC (CLAUDE.md / the 20/min auth limiter). The whole hub is a
// SINGLE describe.serial with a beforeAll that logs in EXACTLY ONCE on a shared
// page; every sub-flow reuses that authenticated page, so the access_token cookie
// is established once and inherited by both page navigation AND page.request — no
// manual token plumbing, no per-test re-login. Run this spec ISOLATED, not
// batched with the other auth-heavy live specs. To halve limiter pressure during
// a live run, pin a single project: `--project=chromium`.
//
// Exact-match submit discipline (CLAUDE.md): the v3.0 /login page hosts the
// primary submit alongside future OAuth buttons, so the submit MUST be selected
// with /^log in$/i to resolve uniquely.
//
// DETERMINISM / SEED HYGIENE (threat T-12-16): every mutation is reverted in the
// same run — the profile name is restored to its original; the language is
// switched back to English. The members add-by-email flow uses the
// DETERMINISTIC-WITHOUT-SEEDING path (an unregistered email → the backend's
// documented 404 → "No registered user with that email." toast/band) rather than
// seeding+removing a second user: the shared dev DB does not guarantee a second
// known registered user, and the 404 branch exercises the same
// addMemberByEmail → POST /members {email, role} contract (12-01 backend:
// ErrUserNotRegistered → 404) without leaving residue. The members LIST + own-row
// "YOU" badge prove the enriched read path (SETT-10).
//
// SELECTOR LESSONS (recent E2E locator-loosening commits + 12-UI-SPEC):
//   - sonner renders toasts as <li>; match the success/error COPY with .first().
//   - RetroConfirmDialog mounts role="dialog"; scope the confirm button inside it.
//   - RetroSelect is a NATIVE <select> labelled by its text — drive it with
//     selectOption({ label }) using the endonym STRING ("Eesti"/"English"),
//     never a RegExp.
//   - duplicated visible text (titlebar + body) → .first().

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

// Shared seeder login. Exact-match submit (multi-button login page). Called
// EXACTLY ONCE from beforeAll on the shared page (auth-limiter discipline).
async function loginAsSeeder(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL("/");
}

test.describe.serial("Settings hub (one login)", () => {
  // The shared, authenticated page. Created once; every sub-flow reuses it so the
  // login happens a single time for the whole file (auth limiter).
  let page: Page;

  // Captured from /users/me before any mutation so the profile-save flow can
  // restore the seed user's original name at the end (seed hygiene / T-12-16).
  let originalFullName = "";

  // This whole suite mutates the SHARED singleton seeder user (profile name,
  // language) and restores it in afterAll. The two Playwright projects
  // (chromium+firefox) run concurrently against the same dev user, so running
  // the suite in both races on the shared mutations/restore. Pin to chromium —
  // one browser is sufficient for a settings-form contract guard. (beforeEach
  // skip is the reliable per-test form; a describe-level conditional skip is
  // not honored consistently under describe.serial.)
  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName !== "chromium",
      "mutates the shared singleton seeder user — chromium-only (parallel-project race)",
    );
  });

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsSeeder(page);
    // SSOT for current values (the same /users/me GetMe the pages read). Cookie
    // is inherited by page.request — no token plumbing.
    const meRes = await page.request.get("/api/users/me");
    expect(meRes.status()).toBe(200);
    originalFullName = ((await meRes.json()) as { full_name: string }).full_name;
  });

  test.afterAll(async () => {
    // Restore the seed user's original name if a prior flow changed it (defense
    // in depth — the profile test also restores inline).
    try {
      if (originalFullName) {
        await page.request.patch("/api/users/me", {
          data: { full_name: originalFullName },
        });
      }
      // Ensure language is left at English regardless of where a flow stopped.
      await page.request.patch("/api/users/me/preferences", {
        data: { language: "en" },
      });
    } finally {
      await page.close();
    }
  });

  // (1) LANDING — SETT-01. /settings is the grouped-row index (NOT a redirect to
  // /settings/security). The three group Windows render their <Link> rows, and
  // clicking Profile navigates to /settings/profile.
  test("landing: /settings shows grouped rows and Profile navigates", async () => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings$/);

    // Grouped-row links across the ACCOUNT / PREFERENCES / WORKSPACE windows.
    await expect(
      page.getByRole("link", { name: /^profile$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^language$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^members$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /data\s*&\s*storage/i }),
    ).toBeVisible();

    // Clicking the Profile row navigates into the subpage (relative <Link>).
    await page.getByRole("link", { name: /^profile$/i }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
    await expect(
      page.getByRole("heading", { name: /^profile$/i }).first(),
    ).toBeVisible();
  });

  // (2) PROFILE SAVE — SETT-02. Edit the Full name to a deterministic value,
  // Save changes, assert the success toast, RELOAD (real backend round-trip via
  // GetMe), and assert the new name persisted. Restore the original name to keep
  // the seed user stable (T-12-16).
  test("profile: edit name → save → persists across reload, then restore", async () => {
    await page.goto("/settings/profile");

    const nameField = page.getByLabel(/full name/i);
    await expect(nameField).toHaveValue(originalFullName);

    const newName = `${originalFullName} ${Date.now()}`;
    await nameField.fill(newName);
    await page.getByRole("button", { name: /save changes/i }).click();

    // sonner success toast (ProfilePage: retroToast.success("Saved.")).
    await expect(page.getByText(/^saved\.?$/i).first()).toBeVisible();

    // Real round-trip: reload and confirm the field is rehydrated from GetMe.
    await page.reload();
    await expect(page.getByLabel(/full name/i)).toHaveValue(newName);

    // Restore via the UI form so the change is exercised both ways and the seed
    // user is left in its original state.
    await page.getByLabel(/full name/i).fill(originalFullName);
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText(/^saved\.?$/i).first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/full name/i)).toHaveValue(originalFullName);
  });

  // (3) LANGUAGE — SETT-05 + I18N-01/02. Switch the native RetroSelect English →
  // Eesti, assert the success toast, RELOAD, assert it persisted (GetMe.language =
  // et). Switch back to English to leave the seed user known.
  //
  // Phase-15 note: et is now a FULLY translated catalog, so loadCatalog(et) fires
  // BEFORE the toast and re-localizes the UI live — the toast reads "Keel
  // uuendatud." (not English) and the select's own label becomes "Liidese keel".
  // The locale-bound `getByLabel(/interface language/i)` therefore can't be used
  // once Estonian is active; target the page's single combobox by role instead,
  // and match the toast in either language. This is the live proof of I18N-02
  // (instant activation, no reload) AND I18N-01 (et strings render).
  test("language: switch en → et persists across reload, then revert", async () => {
    await page.goto("/settings/language");

    // Locale-stable handle: /settings/language renders exactly one <select>.
    const select = page.getByRole("combobox");
    // Drive the NATIVE select by option LABEL — endonyms ("English"/"Eesti") are
    // literal in LanguagePage, NOT translated, so they stay stable across locales.
    await select.selectOption({ label: "Eesti" });

    // onSuccess: loadCatalog(et) activates → t`Language updated.` resolves to the
    // Estonian catalog string. Accept either language so the test is locale-robust.
    await expect(
      page.getByText(/language updated\.?|keel uuendatud\.?/i).first(),
    ).toBeVisible();

    // Persisted via PATCH /users/me/preferences → reload reads it back from GetMe.
    await page.reload();
    await expect(page.getByRole("combobox")).toHaveValue("et");

    // Revert to English (leave the seed user in a known state); en activation
    // re-localizes back, so the toast reads English again.
    await page.getByRole("combobox").selectOption({ label: "English" });
    await expect(
      page.getByText(/language updated\.?|keel uuendatud\.?/i).first(),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole("combobox")).toHaveValue("en");
  });

  // (4) MEMBERS — SETT-10. The list renders the seeder with email + role and a
  // "YOU" badge on the own row (proves the 12-01 enriched read path). Add-by-
  // email uses the DETERMINISTIC unregistered-email path: a guaranteed-absent
  // address → the backend's 404 → "No registered user with that email." surfaced
  // (toast or inline band). This exercises the same addMemberByEmail → POST
  // /members {email, role} contract as a successful add, WITHOUT seeding a second
  // user or leaving residue (chosen over add+remove because the shared dev DB
  // does not guarantee a second known registered user).
  test("members: list shows seeder + YOU; add unregistered email surfaces 404", async () => {
    await page.goto("/settings/members");
    await expect(page).toHaveURL(/\/settings\/members$/);

    // The seeder's own row: email rendered + the "YOU" self badge.
    await expect(page.getByText(E2E_USER).first()).toBeVisible();
    await expect(page.getByText(/^you$/i).first()).toBeVisible();

    // Add-by-email — deterministic 404 path. A unique unregistered address keeps
    // it absent across reruns against the shared dev DB.
    const ghostEmail = `e2e-ghost-${Date.now()}@example.invalid`;
    await page.getByPlaceholder(/user@email/i).fill(ghostEmail);
    await page.getByRole("button", { name: /^add$/i }).click();

    // Backend ErrUserNotRegistered → 404 → "No registered user with that email."
    // surfaced as a sonner toast or an inline danger band (role="alert").
    await expect(
      page.getByText(/no registered user with that email\.?/i).first(),
    ).toBeVisible();
  });
});
