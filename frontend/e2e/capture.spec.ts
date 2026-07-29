import { test, expect, type Page } from "@playwright/test";

// /capture — the mobile rapid-capture loop, end to end against the live stack
// (backend :8080 + Postgres warehouse_dev + Vite :5173, per the CLAUDE.md
// §E2E runbook; no webServer auto-launch).
//
// WHY MANUAL ENTRY: a real camera cannot be driven in a headless browser, so
// this exercises the typed-code path — which funnels through the SAME
// useScanResolve/onDecode as a live decode, so the capture contract below is
// the real one.
//
// WHAT IS GUARDED (the three claims that make this a capture flow):
//   1. an unknown label saves with NO typing beyond the code, and the created
//      item really carries needs_review:true + the code as its short_code —
//      verified through the API, not just the UI;
//   2. the loop re-arms after a save (counter advances, panel closes), which is
//      the whole point versus the ordinary item form;
//   3. a capture WITH a photo lands the image against the entity the same
//      capture created — the create and the upload are one queued unit;
//   4. a label that is already registered offers OPEN instead of a second
//      create — the duplicate guard.
//
// ONE LOGIN, ONE SPEC (Pitfall 5 / the 20/min auth limiter): a single test owns
// the whole flow so login happens exactly once; every later API call rides the
// inherited access_token cookie.
//
// Exact-match submit discipline (CLAUDE.md): the /login submit is selected with
// /^log in$/i so it resolves uniquely.

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

async function loginAsSeeder(page: Page) {
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
}

async function firstWorkspaceId(page: Page): Promise<string> {
  const res = await page.request.get("/api/users/me/workspaces");
  expect(res.status()).toBe(200);
  const workspaces = (await res.json()) as Array<{ id: string }>;
  expect(workspaces.length).toBeGreaterThan(0);
  return workspaces[0].id;
}

test("rapid capture: unknown label → item with needs_review, loop re-arms, photo lands on its capture, known label refuses a duplicate", async ({
  page,
}) => {
  await loginAsSeeder(page);
  const wsId = await firstWorkspaceId(page);

  // A short_code is 4..8 alphanumeric — the ENTITY column cap, tighter than the
  // 4..12 the short_codes registry CHECK allows. A per-run suffix keeps reruns
  // addressable against the shared dev DB while staying inside 8 characters.
  const stamp = String(Date.now()).slice(-6);
  const newCode = `EA${stamp}`;
  const takenCode = `TB${stamp}`;

  // ── Seed a location that already owns `takenCode`, for the duplicate guard.
  const seededName = `E2E-CAPTURE-LOC-${stamp}`;
  const locRes = await page.request.post(`/api/workspaces/${wsId}/locations`, {
    data: { name: seededName, short_code: takenCode },
  });
  expect(locRes.status()).toBe(200);

  // DISCOVERY GATE: the resolve endpoint the page calls must already know the
  // seeded code, so a UI failure below can't be blamed on a bad seed.
  const resolved = await page.request.get(
    `/api/workspaces/${wsId}/short-codes/${encodeURIComponent(takenCode)}`,
  );
  expect(resolved.status()).toBe(200);
  expect(((await resolved.json()) as { name: string }).name).toBe(seededName);

  await page.goto("/capture");

  // ── 1. UNKNOWN LABEL → SAVE AS ITEM. The only input is the code itself.
  await page.getByLabel(/enter code/i).fill(newCode);
  await page.getByRole("button", { name: /look up code/i }).click();

  const saveItem = page.getByRole("button", { name: /save as item/i });
  await expect(saveItem).toBeVisible();
  await saveItem.click();

  // ── 2. THE LOOP RE-ARMS: the action panel closes and the counter advances,
  // leaving the page ready for the next label with no navigation.
  await expect(saveItem).toBeHidden();
  await expect(page.getByText(/1 captured/i)).toBeVisible();

  // The capture is only real if the row landed with the review flag AND the
  // scanned code as its short_code (so rescanning resolves to it).
  await expect(async () => {
    const res = await page.request.get(
      `/api/workspaces/${wsId}/short-codes/${encodeURIComponent(newCode)}`,
    );
    expect(res.status()).toBe(200);
    const match = (await res.json()) as { entity_type: string; entity_id: string };
    expect(match.entity_type).toBe("item");

    const item = await page.request.get(
      `/api/workspaces/${wsId}/items/${match.entity_id}`,
    );
    expect(item.status()).toBe(200);
    const body = (await item.json()) as {
      needs_review: boolean;
      short_code: string;
      name: string;
    };
    // needs_review is what puts it in the desktop fill-in-later queue.
    expect(body.needs_review).toBe(true);
    expect(body.short_code).toBe(newCode);
    expect(body.name).toBe(newCode);
  }).toPass({ timeout: 10000 });

  // ── 3. PHOTO PATH: capture a location WITH a photo attached. The create and
  // the upload travel as one queued unit (the upload needs the id the create
  // assigns), so this is the only place the pairing is proven in a real browser
  // — the unit tests stub the file input, and a stub cannot catch a broken
  // multipart body or a wrong upload URL.
  const photoCode = `LP${stamp}`;
  await page.getByLabel(/enter code/i).fill(photoCode);
  await page.getByRole("button", { name: /look up code/i }).click();

  const saveLocation = page.getByRole("button", { name: /save as location/i });
  await expect(saveLocation).toBeVisible();

  // The input is `.hidden` (a styled button clicks it) — setInputFiles drives
  // it directly, which is exactly what the camera/file picker would do.
  await page.getByLabel(/attach a photo/i).setInputFiles({
    name: "shelf.png",
    mimeType: "image/png",
    // Smallest valid PNG: the backend sniffs the content type, so random bytes
    // would be rejected rather than stored.
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await saveLocation.click();
  await expect(saveLocation).toBeHidden();
  await expect(page.getByText(/2 captured/i)).toBeVisible();

  // The photo is only real if it landed against the location that was just
  // created — that pairing is the whole feature.
  await expect(async () => {
    const res = await page.request.get(
      `/api/workspaces/${wsId}/short-codes/${encodeURIComponent(photoCode)}`,
    );
    expect(res.status()).toBe(200);
    const match = (await res.json()) as {
      entity_type: string;
      entity_id: string;
    };
    expect(match.entity_type).toBe("location");

    const photos = await page.request.get(
      `/api/workspaces/${wsId}/locations/${match.entity_id}/photos`,
    );
    expect(photos.status()).toBe(200);
    const { items } = (await photos.json()) as {
      items: Array<{ mime_type: string; size_bytes: number }>;
    };
    expect(items).toHaveLength(1);
    expect(items[0].mime_type).toBe("image/png");
    expect(items[0].size_bytes).toBeGreaterThan(0);
  }).toPass({ timeout: 10000 });

  // ── 4. ALREADY-REGISTERED LABEL: offer the owner, never a second create.
  await page.getByLabel(/enter code/i).fill(takenCode);
  await page.getByRole("button", { name: /look up code/i }).click();

  await expect(page.getByText(/already registered/i)).toBeVisible();
  await expect(page.getByText(seededName)).toBeVisible();
  await expect(page.getByRole("link", { name: /^open$/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /save as item/i }),
  ).toBeHidden();
});
