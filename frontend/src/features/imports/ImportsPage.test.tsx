import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { RetroToaster } from "@/components/retro";
import { ImportsPage } from "./ImportsPage";

// Phase 14 Plan 05 Task 3 — ImportsPage (SYS-04). Renders under QueryClient +
// Workspace (mocked) + Router + lingui. MSW serves the jobs history, the
// multipart upload, and the workspace export blob. Covers: the history table,
// the admin-gated import action (multipart POST + invalidate), the export reuse
// of settingsApi.exportWorkspace, the non-admin calm gate, and the empty state.

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWorkspace(role: string) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId: "ws-A",
    setWorkspace: vi.fn(),
    workspaces: [{ id: "ws-A", name: "Garage", role }],
    isLoading: false,
  });
}

const JOB = {
  id: "job-1",
  entity_type: "items",
  status: "completed",
  file_name: "items.csv",
  file_size_bytes: 100,
  total_rows: 5,
  processed_rows: 5,
  success_count: 4,
  error_count: 1,
  progress: 100,
  created_at: "2026-06-13T00:00:00Z",
  completed_at: "2026-06-13T00:01:00Z",
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <RetroToaster />
        <MemoryRouter>
          <ImportsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
  // jsdom lacks createObjectURL/revokeObjectURL — patch them onto the REAL URL
  // constructor (never replace the constructor itself: MSW + the api client use
  // `new URL()` for request matching, so a plain-object stub would break every
  // intercepted request).
  URL.createObjectURL = vi.fn().mockReturnValue("blob:mock");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("ImportsPage — history table", () => {
  it("renders job rows with file name, entity type, status, progress, counts", async () => {
    setWorkspace("admin");
    server.use(
      http.get("/api/workspaces/:wsId/imports/jobs", () =>
        HttpResponse.json({ jobs: [JOB], total: 1, page: 1, total_pages: 1 }),
      ),
    );
    renderPage();

    expect(await screen.findByText("items.csv")).toBeInTheDocument();
    const row = screen.getByText("items.csv").closest("tr") as HTMLElement;
    // entity type + status + progress all render in the row.
    expect(within(row).getByText("items")).toBeInTheDocument();
    expect(within(row).getByText(/completed/i)).toBeInTheDocument();
    expect(within(row).getByText("100%")).toBeInTheDocument();
    // success (4) and error (1) counts both surface as discrete cells.
    expect(within(row).getByText("4")).toBeInTheDocument();
    expect(within(row).getByText("1")).toBeInTheDocument();
  });

  it("renders a calm empty state when there are no jobs", async () => {
    setWorkspace("admin");
    server.use(
      http.get("/api/workspaces/:wsId/imports/jobs", () =>
        HttpResponse.json({ jobs: [], total: 0, page: 1, total_pages: 0 }),
      ),
    );
    renderPage();

    expect(await screen.findByText(/no imports yet/i)).toBeInTheDocument();
  });
});

describe("ImportsPage — import action", () => {
  it("uploads a chosen CSV via multipart and invalidates the jobs table", async () => {
    setWorkspace("admin");
    let uploadHit = false;
    let jobsFetches = 0;
    server.use(
      http.get("/api/workspaces/:wsId/imports/jobs", () => {
        jobsFetches += 1;
        const jobs = uploadHit ? [JOB, { ...JOB, id: "job-2" }] : [JOB];
        return HttpResponse.json({
          jobs,
          total: jobs.length,
          page: 1,
          total_pages: 1,
        });
      }),
      http.post("/api/workspaces/:wsId/imports/upload", ({ request }) => {
        uploadHit = true;
        expect(request.headers.get("content-type")).toContain(
          "multipart/form-data",
        );
        return HttpResponse.json({ ...JOB, id: "job-2" }, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("items.csv");
    const before = jobsFetches;

    // Pick a file via the hidden native input, then click Import.
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["sku,name\n1,Drill"], "items.csv", {
      type: "text/csv",
    });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole("button", { name: /^import/i }));

    await waitFor(() => expect(uploadHit).toBe(true));
    await waitFor(() => expect(jobsFetches).toBeGreaterThan(before));
  });
});

describe("ImportsPage — export action", () => {
  it("calls settingsApi.exportWorkspace (the real blob) for an admin", async () => {
    setWorkspace("admin");
    let exportHit = false;
    server.use(
      http.get("/api/workspaces/:wsId/imports/jobs", () =>
        HttpResponse.json({ jobs: [], total: 0, page: 1, total_pages: 0 }),
      ),
      http.get("/api/workspaces/:wsId/export/workspace", () => {
        exportHit = true;
        return new HttpResponse(new Blob(["x"]), { status: 200 });
      }),
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no imports yet/i);

    await user.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => expect(exportHit).toBe(true));
  });
});

describe("ImportsPage — non-admin gate", () => {
  it("surfaces a calm requires-admin state instead of the import + export actions", async () => {
    setWorkspace("member");
    server.use(
      http.get("/api/workspaces/:wsId/imports/jobs", () =>
        HttpResponse.json({ jobs: [], total: 0, page: 1, total_pages: 0 }),
      ),
    );
    renderPage();

    await screen.findByText(/no imports yet/i);
    expect(screen.getAllByText(/requires admin/i).length).toBeGreaterThan(0);
    // No import button for a non-admin.
    expect(
      screen.queryByRole("button", { name: /^import/i }),
    ).not.toBeInTheDocument();
  });
});
