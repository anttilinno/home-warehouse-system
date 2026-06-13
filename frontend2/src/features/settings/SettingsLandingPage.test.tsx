import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";
import { SettingsLandingPage } from "./SettingsLandingPage";

// Phase 12 Plan 02 — SETT-01. The grouped-row landing: three group Windows,
// each row a <Link> to its subroute (relative to /settings). The Paperless row
// is a disabled pointer (aria-disabled), NOT a link. Optional counts render
// only when their query cache is already populated (no fetch on the landing).

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage(client = freshClient()) {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/settings"]}>
        <QueryClientProvider client={client}>
          <ModalStackProvider>
            {/* Nest under a /settings route so relative <Link to="profile">
                resolves to /settings/profile (matching the real route tree). */}
            <Routes>
              <Route path="settings" element={<SettingsLandingPage />} />
            </Routes>
            <RetroToaster />
          </ModalStackProvider>
        </QueryClientProvider>
      </MemoryRouter>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
});

describe("SettingsLandingPage — grouped rows (SETT-01)", () => {
  it("renders the three group titles", () => {
    renderPage();
    expect(screen.getByText("ACCOUNT")).toBeInTheDocument();
    expect(screen.getByText("PREFERENCES")).toBeInTheDocument();
    expect(screen.getByText("WORKSPACE")).toBeInTheDocument();
  });

  it("renders each linkable row as an anchor with the correct /settings href", () => {
    renderPage();
    const cases: Array<[RegExp, string]> = [
      [/^Profile$/, "/settings/profile"],
      [/^Security$/, "/settings/security"],
      [/^Connected Accounts$/, "/settings/accounts"],
      [/^Appearance$/, "/settings/appearance"],
      [/^Language$/, "/settings/language"],
      [/^Regional Formats$/, "/settings/formats"],
      [/^Notifications$/, "/settings/notifications"],
      [/^Members$/, "/settings/members"],
      [/^Data & Storage$/, "/settings/data"],
    ];
    for (const [label, href] of cases) {
      const link = screen.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", href);
    }
  });

  it("renders Paperless as an aria-disabled pointer, NOT a link", () => {
    renderPage();
    // No link role for Paperless.
    expect(
      screen.queryByRole("link", { name: /Paperless/ }),
    ).not.toBeInTheDocument();
    const paperless = screen.getByText("Paperless").closest("li")!;
    expect(within(paperless).getByText("Paperless")).toBeInTheDocument();
    expect(paperless.querySelector('[aria-disabled="true"]')).not.toBeNull();
    expect(within(paperless).getByText("COMING SOON")).toBeInTheDocument();
    expect(within(paperless).getByText("Set up in DMS")).toBeInTheDocument();
  });

  it("renders no leading icons (text label + trailing chevron only)", () => {
    renderPage();
    const profile = screen.getByRole("link", { name: /^Profile$/ });
    // The only glyph in the row is the trailing chevron.
    expect(profile.textContent).toContain("›");
    expect(profile.querySelector("img")).toBeNull();
    expect(profile.querySelector("svg")).toBeNull();
  });

  it("shows the Connected Accounts count badge only when the cache is populated", () => {
    const client = freshClient();
    client.setQueryData(["oauth-accounts"], {
      accounts: [{ provider: "google" }, { provider: "github" }],
    });
    renderPage(client);
    const accountsRow = screen
      .getByRole("link", { name: /Connected Accounts/ })
      .closest("li")!;
    expect(accountsRow.textContent).toMatch(/2\s*LINKED/);
  });

  it("omits the accounts count badge when the cache is empty (no layout shift)", () => {
    renderPage();
    const accountsRow = screen
      .getByRole("link", { name: /Connected Accounts/ })
      .closest("li")!;
    expect(within(accountsRow).queryByText("LINKED")).not.toBeInTheDocument();
  });

  it("shows the Members count badge from a cached ['members', wsId] entry", () => {
    const client = freshClient();
    client.setQueryData(["members", "ws-1"], {
      items: [
        { id: "m1", user_id: "u1", role: "owner" },
        { id: "m2", user_id: "u2", role: "member" },
        { id: "m3", user_id: "u3", role: "viewer" },
      ],
    });
    renderPage(client);
    const membersRow = screen
      .getByRole("link", { name: /Members/ })
      .closest("li")!;
    expect(membersRow.textContent).toMatch(/3\s*members/);
  });
});
