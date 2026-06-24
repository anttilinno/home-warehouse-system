import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import type { WorkspaceContextValue } from "@/features/workspace/WorkspaceProvider";
import { DataStoragePage } from "./DataStoragePage";

// Phase 12 Plan 05 — SETT-09 Data & Storage. Three sections: client-only
// clear-cache (queryClient.clear, NO fetch), admin-gated real workspace export
// (settingsApi.exportWorkspace), and an import POINTER (COMING SOON badge — no
// imports route on this branch). useWorkspace + settingsApi are mocked so the
// page renders without a live provider/backend.

// --- mocks ---------------------------------------------------------------
const exportWorkspace = vi.fn<(wsId: string, format?: string) => Promise<void>>(
  () => Promise.resolve(),
);
// The Show-archived section READS via getMe and WRITES via updatePreferences
// (shared ["me"] query). Default getMe → show_archived: false.
const getMe = vi.fn(() => Promise.resolve({ show_archived: false }));
const updatePreferences = vi.fn((body: Record<string, unknown>) =>
  Promise.resolve(body),
);
vi.mock("@/lib/api/settings", () => ({
  settingsApi: {
    exportWorkspace: (...a: [string, string?]) => exportWorkspace(...a),
    getMe: () => getMe(),
    updatePreferences: (body: Record<string, unknown>) =>
      updatePreferences(body),
  },
}));

let workspaceValue: WorkspaceContextValue;
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => workspaceValue,
}));

function adminWorkspace(): WorkspaceContextValue {
  return {
    currentWorkspaceId: "ws-1",
    setWorkspace: vi.fn(),
    isLoading: false,
    workspaces: [
      {
        id: "ws-1",
        name: "Home",
        slug: "home",
        description: null,
        role: "owner",
        is_personal: false,
      },
    ],
  };
}

function viewerWorkspace(): WorkspaceContextValue {
  return {
    currentWorkspaceId: "ws-1",
    setWorkspace: vi.fn(),
    isLoading: false,
    workspaces: [
      {
        id: "ws-1",
        name: "Home",
        slug: "home",
        description: null,
        role: "viewer",
        is_personal: false,
      },
    ],
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const clearSpy = vi.spyOn(client, "clear");
  const utils = render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <ModalStackProvider>
            <DataStoragePage />
            <RetroToaster />
          </ModalStackProvider>
        </QueryClientProvider>
      </MemoryRouter>
    </I18nProvider>,
  );
  return { ...utils, clearSpy };
}

// Fail loudly if any clear/export path fires a real network request.
const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  workspaceValue = adminWorkspace();
  exportWorkspace.mockClear();
  getMe.mockClear();
  getMe.mockResolvedValue({ show_archived: false });
  updatePreferences.mockClear();
  updatePreferences.mockImplementation((body) => Promise.resolve(body));
  fetchSpy.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DataStoragePage — clear cached data (client-only)", () => {
  it("confirms then calls queryClient.clear() and fires NO fetch", async () => {
    const { clearSpy } = renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: /clear cached data/i }),
    );

    // butter confirm dialog
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /clear cached data/i }),
    );

    await waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Cached data cleared.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("cancelling the confirm does not clear the cache", async () => {
    const { clearSpy } = renderPage();
    await userEvent.click(
      screen.getByRole("button", { name: /clear cached data/i }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /cancel/i }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(clearSpy).not.toHaveBeenCalled();
  });
});

describe("DataStoragePage — export (admin-gated, real endpoint)", () => {
  it("admin/owner sees the export button → calls exportWorkspace(wsId, 'xlsx')", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() =>
      expect(exportWorkspace).toHaveBeenCalledWith("ws-1", "xlsx"),
    );
  });

  it("export failure (e.g. 403) surfaces a danger toast", async () => {
    exportWorkspace.mockRejectedValueOnce(new Error("forbidden"));
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /export/i }));
    expect(
      await screen.findByText("Couldn't export. Try again."),
    ).toBeInTheDocument();
  });

  it("a non-admin (viewer) role does NOT see the export action", async () => {
    workspaceValue = viewerWorkspace();
    renderPage();
    expect(
      screen.queryByRole("button", { name: /export/i }),
    ).not.toBeInTheDocument();
    // An explanatory note replaces the action.
    expect(screen.getByText(/admin/i)).toBeInTheDocument();
  });
});

describe("DataStoragePage — show archived (global preference)", () => {
  it("reflects the current show_archived value from getMe", async () => {
    getMe.mockResolvedValue({ show_archived: true });
    renderPage();
    const toggle = (await screen.findByRole("checkbox", {
      name: /show archived items/i,
    })) as HTMLInputElement;
    await waitFor(() => expect(toggle.checked).toBe(true));
  });

  it("toggling ON writes show_archived: true via updatePreferences", async () => {
    renderPage();
    const toggle = await screen.findByRole("checkbox", {
      name: /show archived items/i,
    });
    await userEvent.click(toggle);
    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({ show_archived: true }),
    );
  });
});

describe("DataStoragePage — import pointer", () => {
  it("renders a disabled COMING SOON badge (no imports route on this branch)", () => {
    renderPage();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    // No live link to an imports route.
    expect(
      screen.queryByRole("link", { name: /imports/i }),
    ).not.toBeInTheDocument();
  });
});

describe("DataStoragePage — online-only invariant", () => {
  it("source contains no offline-storage imports (idb/serwist/sync*)", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/features/settings/DataStoragePage.tsx"),
      "utf8",
    );
    expect(/idb|serwist|sync[A-Z]/.test(src)).toBe(false);
  });
});
