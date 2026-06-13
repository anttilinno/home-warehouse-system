import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";
import { PaperlessPage } from "./PaperlessPage";

// Phase 14b Plan 04 — PaperlessPage (PPL-01 settings + PPL-02 search). wsId is
// sourced from useWorkspace() — mocked so the page renders with a stable id.

vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => ({ currentWorkspaceId: "ws-1" }),
}));

const SETTINGS_PATH = "/api/workspaces/ws-1/paperless/settings";
const SEARCH_PATH = "/api/workspaces/ws-1/paperless/search";

const UNCONFIGURED = {
  configured: false,
  is_enabled: false,
  sync_tags_enabled: false,
  has_token: false,
};

const CONFIGURED = {
  configured: true,
  base_url: "https://paperless.example",
  is_enabled: true,
  sync_tags_enabled: false,
  has_token: true,
  updated_at: "2026-06-13T00:00:00Z",
};

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={freshClient()}>
        <PaperlessPage />
        <RetroToaster />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  i18n.activate("en");
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

describe("PaperlessPage — settings (PPL-01)", () => {
  it("renders the unconfigured state and SAVE issues a PUT with the entered url", async () => {
    let putBody: Record<string, unknown> | null = null;
    server.use(
      http.get(SETTINGS_PATH, () => HttpResponse.json(UNCONFIGURED)),
      http.put(SETTINGS_PATH, async ({ request }) => {
        putBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...CONFIGURED, base_url: putBody.base_url });
      }),
    );

    renderPage();

    const url = await screen.findByLabelText(/paperless url/i);
    await userEvent.type(url, "https://paperless.example");
    await userEvent.type(screen.getByLabelText(/api token/i), "secret-token");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(putBody).not.toBeNull());
    expect(putBody).toMatchObject({
      base_url: "https://paperless.example",
      api_token: "secret-token",
    });
  });
});

describe("PaperlessPage — search (PPL-02)", () => {
  it("renders search results from a mocked search when configured + enabled", async () => {
    server.use(
      http.get(SETTINGS_PATH, () => HttpResponse.json(CONFIGURED)),
      http.get(SEARCH_PATH, () =>
        HttpResponse.json({
          count: 1,
          results: [
            { id: 42, title: "Fridge manual", created: "2026-01-01T00:00:00Z" },
          ],
        }),
      ),
    );

    renderPage();

    const queryInput = await screen.findByLabelText(/search paperless/i);
    await waitFor(() => expect(queryInput).toBeEnabled());
    await userEvent.type(queryInput, "fridge");
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));

    expect(await screen.findByText("Fridge manual")).toBeInTheDocument();
  });
});
