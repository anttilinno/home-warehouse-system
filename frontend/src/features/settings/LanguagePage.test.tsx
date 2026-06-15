import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";

// Phase 12 Plan 04 — SETT-05. LanguagePage: a RetroSelect (en/et/ru) that
// PATCHes {language} FIRST, then calls loadCatalog(locale) EXACTLY ONCE in the
// mutation onSuccess (event handler, never render — Pitfall 4 render-loop guard).

// loadCatalog is mocked so the test can assert call count + ordering without
// touching the real lingui catalog import (et/ru .po files are Phase-15 stubs).
const loadCatalog = vi.fn(async (_locale: string) => {});
vi.mock("@/lib/i18n", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/i18n")>("@/lib/i18n");
  return { ...actual, loadCatalog: (locale: string) => loadCatalog(locale) };
});

// Imported AFTER the mock so the component binds to the mocked loadCatalog.
const { LanguagePage } = await import("./LanguagePage");

const ME_PATH = "/api/users/me";
const PREFS_PATH = "/api/users/me/preferences";

const ME = {
  id: "user-1",
  email: "seeder@test.local",
  full_name: "Seed Er",
  avatar_url: null,
  has_password: true,
  language: "en",
};

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={freshClient()}>
        <LanguagePage />
        <RetroToaster />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  loadCatalog.mockClear();
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

describe("LanguagePage — interface language (SETT-05)", () => {
  it("PATCHes {language} then calls loadCatalog once with the new locale, after the PATCH resolves", async () => {
    const order: string[] = [];
    let patchedBody: Record<string, unknown> | null = null;
    let resolved = false;
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME)),
      http.patch(PREFS_PATH, async ({ request }) => {
        patchedBody = (await request.json()) as Record<string, unknown>;
        order.push("patch");
        resolved = true;
        return HttpResponse.json({ ...ME, language: "et" });
      }),
    );
    loadCatalog.mockImplementation(async () => {
      order.push("loadCatalog");
    });

    renderPage();

    // Select pre-fills from ["me"].language ("en").
    const select = await screen.findByLabelText(/interface language/i);
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe("en"));

    await userEvent.selectOptions(select, "et");

    await waitFor(() => expect(resolved).toBe(true));
    await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(1));

    expect(patchedBody).toEqual({ language: "et" });
    expect(loadCatalog).toHaveBeenCalledWith("et");
    // Ordering: PATCH resolves BEFORE loadCatalog (onSuccess, not render).
    expect(order).toEqual(["patch", "loadCatalog"]);
    expect(await screen.findByText("Language updated.")).toBeInTheDocument();
  });

  it("does not call loadCatalog if the PATCH fails", async () => {
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME)),
      http.patch(PREFS_PATH, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    renderPage();
    const select = await screen.findByLabelText(/interface language/i);
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe("en"));
    await userEvent.selectOptions(select, "ru");

    await waitFor(() =>
      expect(screen.getByLabelText(/interface language/i)).toBeInTheDocument(),
    );
    // loadCatalog must never fire when the persist step rejects.
    expect(loadCatalog).not.toHaveBeenCalled();
  });
});
