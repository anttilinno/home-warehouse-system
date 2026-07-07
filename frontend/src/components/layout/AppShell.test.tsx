import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/useTheme";
import { ShortcutsProvider } from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { MockEventSource } from "@/test/setup";
import { AppShell } from "./AppShell";

// AppShell now mounts the D-12 WorkspaceProvider (which probes ["workspaces"]
// via useQuery), so the shell render needs a QueryClientProvider. The MSW shared
// server (src/test/setup.ts) answers /api/users/me/workspaces with one
// workspace, so the switcher renders its single-workspace pill — enough for the
// chrome/Outlet assertions here (switcher behavior lives in its own spec).
function renderShell(initialPath = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <ThemeProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[initialPath]}>
            <ShortcutsProvider>
              <ModalStackProvider>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route path="/" element={<p>Route content here</p>} />
                    <Route path="/items" element={<p>Items content</p>} />
                  </Route>
                </Routes>
              </ModalStackProvider>
            </ShortcutsProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </I18nProvider>,
  );
}

describe("AppShell", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-06-12T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the grid chrome (TopBar, Sidebar, Bottombar) and the route Outlet", () => {
    renderShell("/");
    // TopBar: its workspace pill is unique chrome.
    expect(screen.getByTestId("workspace-pill")).toBeInTheDocument(); // TopBar
    expect(
      screen.getByRole("navigation", { name: /primary/i }),
    ).toBeInTheDocument(); // Sidebar
    expect(screen.getByRole("contentinfo")).toBeInTheDocument(); // Bottombar
    expect(screen.getByText("Route content here")).toBeInTheDocument(); // Outlet
  });

  it("mounts SSEProvider under WorkspaceProvider — exactly one EventSource opens (PROV-01)", async () => {
    // AppShell now owns WorkspaceProvider > SSEProvider > ShellChrome. Once the
    // MSW-backed workspace probe resolves a wsId, SSEProvider constructs ONE
    // EventSource (the global MockEventSource stub). The shell must render its
    // chrome without throwing under the provider stack.
    renderShell("/");
    expect(screen.getByTestId("workspace-pill")).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(MockEventSource.openCount).toBe(1);
    });
    // The single connection points at the workspace SSE endpoint with cookie auth.
    expect(MockEventSource.last?.url).toMatch(/\/workspaces\/.+\/sse$/);
    expect(MockEventSource.last?.withCredentials).toBe(true);
  });

  it("carries data-collapsed on the grid root and toggles it via the collapse control", async () => {
    const user = userEvent.setup();
    const { container } = renderShell("/");
    const grid = container.querySelector(".app-shell") as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.getAttribute("data-collapsed")).toBe("false");

    await user.click(
      screen.getByRole("button", { name: /collapse navigator/i }),
    );
    expect(grid.getAttribute("data-collapsed")).toBe("true");
  });

  it("renders a Skip to content link as the first focusable element targeting #main", () => {
    const { container } = renderShell("/");
    const skip = screen.getByRole("link", { name: /skip to content/i });
    expect(skip).toHaveAttribute("href", "#main");
    // It is the first focusable element in the DOM.
    const focusables = container.querySelectorAll(
      'a[href], button, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusables[0]).toBe(skip);
    // The target main exists with id + tabIndex -1.
    const main = container.querySelector("#main") as HTMLElement;
    expect(main).not.toBeNull();
    expect(main.getAttribute("tabindex")).toBe("-1");
  });

  it("holds the responsive class contract: Bottombar hidden md:flex, Fab md:hidden", () => {
    renderShell("/");
    const bottombar = screen.getByRole("contentinfo");
    expect(bottombar.className).toContain("hidden");
    expect(bottombar.className).toContain("md:flex");
    const fab = screen.getByRole("button", { name: /quick actions/i });
    // The FAB's md:hidden wrapper gates it to <768px.
    const fabWrapper = fab.closest(".md\\:hidden");
    expect(fabWrapper).not.toBeNull();
  });

  it("uses NO JS layout measurement APIs (CSS-only collapse — SHELL-02)", () => {
    // Read the component source (vitest cwd is the frontend package root).
    const src = readFileSync(
      resolve(process.cwd(), "src/components/layout/AppShell.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/ResizeObserver|offsetWidth|getBoundingClientRect/);
  });

  it("opens the F1 help dialog from the Bottombar F1 chip and closes it with ESC", async () => {
    const user = userEvent.setup();
    renderShell("/");
    await user.click(screen.getByRole("button", { name: /help/i }));
    expect(
      screen.getByRole("dialog", { name: /keyboard shortcuts/i }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: /keyboard shortcuts/i }),
    ).not.toBeInTheDocument();
  });

  it("derives the PageHeader breadcrumb from the current route", () => {
    renderShell("/items");
    // The breadcrumb shows the items route leaf (label content is "Items";
    // the uppercase is CSS). Scope to the Breadcrumb nav — "Items" also appears
    // as a sidebar nav label.
    const crumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumb).getByText("Items")).toBeInTheDocument();
    expect(within(crumb).getByText("Inventory")).toBeInTheDocument();
  });

  it("ESC navigates back through history when no overlay is open", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <I18nProvider i18n={i18n}>
        <ThemeProvider>
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={["/", "/items"]} initialIndex={1}>
              <ShortcutsProvider>
                <ModalStackProvider>
                  <Routes>
                    <Route element={<AppShell />}>
                      <Route path="/" element={<p>Route content here</p>} />
                      <Route path="/items" element={<p>Items content</p>} />
                    </Route>
                  </Routes>
                </ModalStackProvider>
              </ShortcutsProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </ThemeProvider>
      </I18nProvider>,
    );
    expect(screen.getByText("Items content")).toBeInTheDocument();
    // No overlay open → ESC pops history back to "/".
    await user.keyboard("{Escape}");
    expect(await screen.findByText("Route content here")).toBeInTheDocument();
  });

  it("ESC closes an open overlay instead of navigating back (modal-stack wins)", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <I18nProvider i18n={i18n}>
        <ThemeProvider>
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={["/", "/items"]} initialIndex={1}>
              <ShortcutsProvider>
                <ModalStackProvider>
                  <Routes>
                    <Route element={<AppShell />}>
                      <Route path="/" element={<p>Route content here</p>} />
                      <Route path="/items" element={<p>Items content</p>} />
                    </Route>
                  </Routes>
                </ModalStackProvider>
              </ShortcutsProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </ThemeProvider>
      </I18nProvider>,
    );
    // Open the F1 help dialog (an overlay on the modal stack).
    await user.click(screen.getByRole("button", { name: /help/i }));
    expect(
      screen.getByRole("dialog", { name: /keyboard shortcuts/i }),
    ).toBeInTheDocument();
    // ESC closes the overlay (capture-phase preventDefault) — NO history-back.
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: /keyboard shortcuts/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Items content")).toBeInTheDocument();
  });
});
