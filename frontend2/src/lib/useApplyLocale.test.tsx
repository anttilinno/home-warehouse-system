import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { server } from "@/test/msw/server";

// loadCatalog does a Vite dynamic .po import + activates the singleton; mock it
// so the test asserts the ACTIVATION CONTRACT (which locale, how many times)
// without touching real catalogs. locales/i18n stay real.
const { loadCatalog } = vi.hoisted(() => ({
  loadCatalog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/i18n", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/i18n")>();
  return { ...actual, loadCatalog };
});

import { i18n } from "@/lib/i18n";
import { useApplyLocale } from "./useApplyLocale";

const ME_PATH = "/api/users/me";

function Probe() {
  useApplyLocale();
  return null;
}

function renderProbe() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  loadCatalog.mockClear();
  // Establish a known active locale so the "already active" early-out is testable.
  i18n.load("en", {});
  i18n.activate("en");
});

afterEach(() => {
  server.resetHandlers();
});

describe("useApplyLocale", () => {
  it("activates the user's persisted locale when it differs from the active one", async () => {
    server.use(http.get(ME_PATH, () => HttpResponse.json({ language: "ru" })));
    renderProbe();
    await waitFor(() => expect(loadCatalog).toHaveBeenCalledWith("ru"));
  });

  it("does NOT re-activate when the persisted locale already matches", async () => {
    server.use(http.get(ME_PATH, () => HttpResponse.json({ language: "en" })));
    renderProbe();
    // Give the query time to resolve, then assert no redundant catalog import.
    await waitFor(() => undefined);
    await new Promise((r) => setTimeout(r, 50));
    expect(loadCatalog).not.toHaveBeenCalled();
  });

  it("ignores an unknown/garbage persisted locale (defensive)", async () => {
    server.use(http.get(ME_PATH, () => HttpResponse.json({ language: "xx" })));
    renderProbe();
    await new Promise((r) => setTimeout(r, 50));
    expect(loadCatalog).not.toHaveBeenCalled();
  });

  it("does nothing while the session/me query is unresolved", async () => {
    server.use(http.get(ME_PATH, () => new HttpResponse(null, { status: 401 })));
    renderProbe();
    await new Promise((r) => setTimeout(r, 50));
    expect(loadCatalog).not.toHaveBeenCalled();
  });
});
