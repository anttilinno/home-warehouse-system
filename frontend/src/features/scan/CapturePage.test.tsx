import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { registerMutationDefaults } from "@/lib/offline/mutationDefaults";
import { triggerDecode, resetScannerMock } from "@/test/scanner-mock";

// CapturePage — the mobile scan → save → next loop. Asserts the three things
// that make it a capture flow rather than a form: an unknown code saves with
// needs_review (no typing), a known code refuses to duplicate, and the camera
// re-arms after each save.

vi.mock("@yudiel/react-qr-scanner", () => import("@/test/scanner-mock"));

const useTorchMock = vi.fn();
vi.mock("./useTorch", () => ({ useTorch: () => useTorchMock() }));

vi.mock("./useScanFeedback", () => ({
  useScanFeedback: () => ({
    success: vi.fn(),
    error: vi.fn(),
    flash: 0,
    reducedMotion: false,
    primeAudio: vi.fn(),
  }),
}));

const WS = "ws-1";
const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function renderCapture() {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId: WS,
    setWorkspace: vi.fn(),
    workspaces: [],
    isLoading: false,
  });
  useTorchMock.mockReturnValue({
    supported: false,
    enabled: false,
    toggle: vi.fn(),
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  registerMutationDefaults(client);
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <MemoryRouter initialEntries={["/capture"]}>
            <Routes>
              <Route path="/capture" element={<CapturePageLazy />} />
              <Route path="/items/:id" element={<div>ITEM DETAIL</div>} />
            </Routes>
          </MemoryRouter>
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

// Imported eagerly (the route in the app is lazy; the test needs it inline).
import { CapturePage as CapturePageLazy } from "./CapturePage";

/** Code unknown to both the barcode lookup and the short-code registry. */
function installUnknownCode() {
  server.use(
    http.get("/api/workspaces/:wsId/items/by-barcode/:code", () =>
      HttpResponse.json({ detail: "not found" }, { status: 404 }),
    ),
    http.get("/api/workspaces/:wsId/short-codes/:code", () =>
      HttpResponse.json({ detail: "not found" }, { status: 404 }),
    ),
  );
}

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

beforeEach(() => {
  resetScannerMock();
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  localStorage.clear();
  onlineManager.setOnline(true); // restore the default for later tests
});

describe("CapturePage", () => {
  it("saves an unknown label as an item flagged needs_review, with no typing", async () => {
    const user = userEvent.setup();
    installUnknownCode();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/workspaces/:wsId/items", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "it-new", name: "7F3K2A" });
      }),
    );

    renderCapture();
    triggerDecode("7F3K2A", "qr_code");

    await user.click(
      await screen.findByRole("button", { name: /save as item/i }),
    );

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      sku: "7F3K2A",
      name: "7F3K2A",
      needs_review: true,
      // Our own label (4..12 alphanumeric) becomes the short_code, so scanning
      // it again resolves to this item instead of creating a second one.
      short_code: "7F3K2A",
    });
    expect(body).not.toHaveProperty("barcode");
  });

  it("routes a product barcode to `barcode`, not short_code", async () => {
    const user = userEvent.setup();
    installUnknownCode();
    // Collected into an array, not a `let … = null`: TS narrows the latter to
    // `null` (it does not see the handler's assignment as widening), so
    // `body?.short_code` reads as `never` and fails the build.
    const sent: Record<string, unknown>[] = [];
    server.use(
      http.post("/api/workspaces/:wsId/items", async ({ request }) => {
        sent.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ id: "it-new", name: "x" });
      }),
    );

    renderCapture();
    triggerDecode("4006381333931", "ean_13"); // 13 digits — over the code cap

    await user.click(
      await screen.findByRole("button", { name: /save as item/i }),
    );

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ barcode: "4006381333931" });
    expect(sent[0].short_code).not.toBe("4006381333931");
  });

  it("treats a 9-char code as a barcode — the entity short_code cap is 8", async () => {
    const user = userEvent.setup();
    installUnknownCode();
    const sent: Record<string, unknown>[] = [];
    server.use(
      http.post("/api/workspaces/:wsId/items", async ({ request }) => {
        sent.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ id: "it-new", name: "x" });
      }),
    );

    renderCapture();
    // Passes the registry's 4..12 CHECK but exceeds the item/location column
    // cap of 8 — sending it as short_code 422s.
    triggerDecode("ABCD12345", "qr_code");

    await user.click(
      await screen.findByRole("button", { name: /save as item/i }),
    );

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].short_code).not.toBe("ABCD12345");
    expect(String(sent[0].short_code)).toHaveLength(8);
    expect(sent[0]).toMatchObject({ barcode: "ABCD12345" });
  });

  it("blocks SAVE AS LOCATION for a code that can't be a short_code", async () => {
    installUnknownCode();
    renderCapture();
    triggerDecode("4006381333931", "ean_13");

    // A location has no barcode field, so this code could never be attached.
    await expect(
      screen.findByRole("button", { name: /save as location/i }),
    ).resolves.toBeDisabled();
    await expect(
      screen.findByRole("button", { name: /save as item/i }),
    ).resolves.toBeEnabled();
  });

  it("re-arms the camera after a save (the loop keeps going)", async () => {
    const user = userEvent.setup();
    installUnknownCode();
    server.use(
      http.post("/api/workspaces/:wsId/items", () =>
        HttpResponse.json({ id: "it-new", name: "7F3K2A" }),
      ),
    );

    renderCapture();
    triggerDecode("7F3K2A", "qr_code");
    await user.click(
      await screen.findByRole("button", { name: /save as item/i }),
    );

    // Action panel gone → back to scanning, and the counter advanced.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /save as item/i }),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(/1 captured/i)).toBeInTheDocument();
  });

  it("refuses to duplicate a code the registry already knows", async () => {
    installUnknownCode();
    server.use(
      http.get("/api/workspaces/:wsId/short-codes/:code", () =>
        HttpResponse.json({
          entity_type: "location",
          entity_id: "loc-1",
          name: "Garage shelf B",
        }),
      ),
    );

    renderCapture();
    triggerDecode("7F3K2A", "qr_code");

    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
    expect(screen.getByText(/Garage shelf B/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save as item/i }),
    ).not.toBeInTheDocument();
  });

  it("saves an unknown label as a location", async () => {
    const user = userEvent.setup();
    installUnknownCode();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/workspaces/:wsId/locations", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "loc-new", name: "7F3K2A" });
      }),
    );

    renderCapture();
    triggerDecode("7F3K2A", "qr_code");

    await user.click(
      await screen.findByRole("button", { name: /save as location/i }),
    );

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ name: "7F3K2A", short_code: "7F3K2A" });
  });

  it("keeps the loop moving while offline (queues instead of hanging)", async () => {
    const user = userEvent.setup();
    installUnknownCode();
    let posts = 0;
    server.use(
      http.post("/api/workspaces/:wsId/items", () => {
        posts += 1;
        return HttpResponse.json({ id: "it-new", name: "7F3K2A" });
      }),
    );

    renderCapture();
    onlineManager.setOnline(false);
    triggerDecode("7F3K2A", "qr_code");

    // Offline the lookup can never answer, so the actions must appear anyway —
    // with the skipped duplicate check called out.
    const saveButton = await screen.findByRole("button", {
      name: /save as item/i,
    });
    expect(screen.getByText(/offline/i)).toBeInTheDocument();

    await user.click(saveButton);

    // The write is queued, NOT awaited: the panel closes and the counter moves
    // even though nothing has reached the server.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /save as item/i }),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(/1 captured/i)).toBeInTheDocument();
    expect(posts).toBe(0);

    // …and the second pill says so: "captured" alone would read as "saved"
    // when the server has seen nothing.
    expect(await screen.findByText(/1 syncing/i)).toBeInTheDocument();

    // Reconnecting drains the queue.
    onlineManager.setOnline(true);
    await waitFor(() => expect(posts).toBe(1));

    // Drained — the syncing pill clears itself, the captured count stays.
    await waitFor(() =>
      expect(screen.queryByText(/1 syncing/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/1 captured/i)).toBeInTheDocument();
  });

  it("queues the same code only once while offline (the duplicate check the registry can't do)", async () => {
    const user = userEvent.setup();
    installUnknownCode();
    let posts = 0;
    server.use(
      http.post("/api/workspaces/:wsId/items", () => {
        posts += 1;
        return HttpResponse.json({ id: "it-new", name: "7F3K2A" });
      }),
    );

    renderCapture();
    onlineManager.setOnline(false);

    // Scan and save the same label twice — offline, so short-code resolution
    // cannot run and neither scan looks any different to the page.
    for (let i = 0; i < 2; i++) {
      triggerDecode("7F3K2A", "qr_code");
      await user.click(
        await screen.findByRole("button", { name: /save as item/i }),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: /save as item/i }),
        ).not.toBeInTheDocument(),
      );
    }

    // The second save was refused: one capture counted, one queued write.
    expect(await screen.findByText(/1 captured/i)).toBeInTheDocument();
    expect(await screen.findByText(/already captured/i)).toBeInTheDocument();

    // …and the drain confirms it — without the guard this posts twice, the
    // second dying on a short-code conflict.
    onlineManager.setOnline(true);
    await waitFor(() => expect(posts).toBe(1));
  });

  it("uploads the captured photo to the location it just created", async () => {
    const user = userEvent.setup();
    installUnknownCode();
    let uploadedTo: string | null = null;
    server.use(
      http.post("/api/workspaces/:wsId/locations", () =>
        HttpResponse.json({ id: "loc-new", name: "7F3K2A" }),
      ),
      http.post(
        "/api/workspaces/:wsId/locations/:locationId/photos",
        ({ params }) => {
          uploadedTo = params.locationId as string;
          return HttpResponse.json({
            id: "lp-1",
            location_id: "loc-new",
            file_id: "f-1",
            original_name: "shelf.jpg",
            mime_type: "image/jpeg",
            size_bytes: 4,
            created_at: "2026-07-27T00:00:00Z",
            url: "/workspaces/ws-1/location-photos/lp-1/file",
          });
        },
      ),
    );

    renderCapture();
    triggerDecode("7F3K2A", "qr_code");

    const picker = await screen.findByLabelText(/attach a photo/i);
    await user.upload(
      picker,
      new File(["JPEG"], "shelf.jpg", { type: "image/jpeg" }),
    );
    await user.click(screen.getByRole("button", { name: /save as location/i }));

    // The photo follows the location that was just created — that pairing is
    // the whole point of capturing on a phone.
    await waitFor(() => expect(uploadedTo).toBe("loc-new"));
  });
});
