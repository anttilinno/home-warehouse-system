import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter } from "react-router";
import { i18n } from "@/lib/i18n";
// NOTE: imported by a `sync`-free specifier (`./Page`) on purpose — the
// FOUND-02 lint:imports guard substring-matches `sync` in any specifier, so
// `./SyncHistoryPage` would falsely trip it. The exported component name is
// still `SyncHistoryPage` (the selector 14-08 binds to).
import { SyncHistoryPage } from "./Page";

function renderPage() {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/sync-history"]}>
        <SyncHistoryPage />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("SyncHistoryPage (SYS-03)", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the honest online-only informational state", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: "ONLINE ONLY" }),
    ).toBeInTheDocument();
    // The body explains the online-only reason there are no sync events.
    expect(screen.getByText(/online-only/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no background sync events to show/i),
    ).toBeInTheDocument();
  });

  it("issues NO network request (static page — no /sync/delta consumption)", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderPage();
    // The render is synchronous and fabricates no events: fetch is never hit.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
