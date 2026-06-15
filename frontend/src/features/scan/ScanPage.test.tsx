import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import type { Item } from "@/lib/types";
import {
  lastScannerProps,
  resetScannerMock,
  triggerDecode,
  triggerScannerError,
} from "@/test/scanner-mock";

// Mock the real scanner library with the Wave-0 fake so no getUserMedia runs.
vi.mock("@yudiel/react-qr-scanner", () => import("@/test/scanner-mock"));

// Torch probe must never touch a real camera in jsdom — force unsupported so
// the toggle stays hidden and the probe getUserMedia is skipped (iOS branch).
const useTorchMock = vi.fn();
vi.mock("./useTorch", () => ({
  useTorch: () => useTorchMock(),
}));

// useScanFeedback is a leaf hook (own unit test); stub it here so the integration
// test does not pull in ios-haptics / AudioContext side effects under jsdom.
const primeAudioMock = vi.fn();
const successMock = vi.fn();
vi.mock("./useScanFeedback", () => ({
  useScanFeedback: () => ({
    success: successMock,
    error: vi.fn(),
    flash: 0,
    reducedMotion: false,
    primeAudio: primeAudioMock,
  }),
}));

const WS = "ws-A";
const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [],
    isLoading: false,
  });
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "it-1",
    workspace_id: WS,
    sku: "SKU-1",
    name: "Cordless Drill",
    description: "A handy drill",
    barcode: "BC-12345",
    min_stock_level: 4,
    short_code: "code-1",
    is_archived: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-10T00:00:00Z",
    ...overrides,
  };
}

interface Fixtures {
  item?: Item | null;
  status?: number;
}

function installLookup(f: Fixtures) {
  server.use(
    http.get("/api/workspaces/:wsId/items/by-barcode/:code", () => {
      if (f.status && f.status !== 200) {
        return new HttpResponse(null, { status: f.status });
      }
      if (f.item === null) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json(f.item ?? makeItem());
    }),
    // QuickActionMenu fires loansApi.byItem on open — keep it empty so the LOAN
    // gate resolves and the dialog renders without a network error.
    http.get("/api/workspaces/:wsId/loans", () =>
      HttpResponse.json({ active: [], history: [] }),
    ),
    http.get("/api/workspaces/:wsId/items/:id/loans", () =>
      HttpResponse.json({ active: [], history: [] }),
    ),
  );
}

// Default torch return: unsupported (toggle hidden).
function setTorch(supported = false, enabled = false, toggle = vi.fn()) {
  useTorchMock.mockReturnValue({ supported, enabled, toggle });
}

async function renderScan() {
  setWsId(WS);
  setTorch(false);
  const { ScanPage } = await import("./ScanPage");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <MemoryRouter initialEntries={["/scan"]}>
            <Routes>
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/items/:id" element={<div>ITEM DETAIL</div>} />
            </Routes>
          </MemoryRouter>
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

afterEach(() => {
  server.resetHandlers();
  resetScannerMock();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("ScanPage — persistent scanner + single funnel", () => {
  it("mounts the scanner node ONCE and keeps it mounted across tab switches", async () => {
    const user = userEvent.setup();
    installLookup({ item: makeItem() });
    await renderScan();

    // Scanner is mounted on first render (the persistent sibling layer).
    expect(
      screen.getByTestId("fake-scanner-decode-trigger"),
    ).toBeInTheDocument();
    const initialMounts = lastScannerProps.current ? 1 : 0;
    expect(initialMounts).toBe(1);

    // Switch to Manual, then History, then back to Scan.
    await user.click(screen.getByRole("tab", { name: /manual/i }));
    await user.click(screen.getByRole("tab", { name: /history/i }));
    await user.click(screen.getByRole("tab", { name: /scan/i }));

    // The scanner trigger is STILL in the DOM the entire time (never unmounted).
    expect(
      screen.getByTestId("fake-scanner-decode-trigger"),
    ).toBeInTheDocument();
  });

  it("a live decode funnels → LOADING then MATCH banner → ACTIONS opens the quick menu", async () => {
    const user = userEvent.setup();
    installLookup({ item: makeItem({ name: "Cordless Drill" }) });
    await renderScan();

    triggerDecode("BC-12345", "ean_13");

    const matchPill = await screen.findByText(/^match$/i);
    expect(matchPill).toBeInTheDocument();
    expect(screen.getByText("Cordless Drill")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /actions/i }));
    expect(await screen.findByText(/matched item/i)).toBeInTheDocument();
  });

  it("manual submit funnels through the same handler (NOT FOUND banner)", async () => {
    const user = userEvent.setup();
    installLookup({ status: 404 });
    await renderScan();

    await user.click(screen.getByRole("tab", { name: /manual/i }));
    await user.type(screen.getByLabelText(/enter code/i), "9999");
    await user.click(screen.getByRole("button", { name: /look up code/i }));

    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });

  it("history tap re-fires the funnel", async () => {
    const user = userEvent.setup();
    installLookup({ item: makeItem({ name: "Cordless Drill" }) });
    await renderScan();

    // First a live decode records a history entry + opens MATCH.
    triggerDecode("BC-12345", "ean_13");
    await screen.findByText(/^match$/i);

    // Back to scan (resume), then open History and re-tap the recorded code.
    await user.click(screen.getByRole("tab", { name: /history/i }));
    const row = await screen.findByRole("button", { name: /BC-12345/i });
    await user.click(row);

    // The funnel re-fired: a MATCH banner shows again.
    expect(await screen.findByText(/^match$/i)).toBeInTheDocument();
  });

  it("camera onError (NotAllowedError) → CAMERA BLOCKED + SWITCH TO MANUAL", async () => {
    const user = userEvent.setup();
    installLookup({ item: makeItem() });
    await renderScan();

    const err = new Error("denied");
    err.name = "NotAllowedError";
    triggerScannerError(err);

    expect(await screen.findByText(/camera blocked/i)).toBeInTheDocument();
    const switchBtn = screen.getByRole("button", { name: /switch to manual/i });
    await user.click(switchBtn);

    // Manual entry is now usable.
    expect(screen.getByLabelText(/enter code/i)).toBeInTheDocument();
  });

  it("torch toggle renders only when useTorch.supported", async () => {
    // First: unsupported → no toggle.
    installLookup({ item: makeItem() });
    await renderScan();
    expect(
      screen.queryByRole("button", { name: /torch/i }),
    ).not.toBeInTheDocument();
  });
});
