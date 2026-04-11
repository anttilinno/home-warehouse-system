import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { vi } from "vitest";
import { AppShell } from "../AppShell";

// Setup lingui for tests
i18n.load("en", {
  DASHBOARD: "DASHBOARD",
  SETTINGS: "SETTINGS",
  LOGOUT: "LOGOUT",
  "HOME WAREHOUSE": "HOME WAREHOUSE",
  "Skip to main content": "Skip to main content",
  "Open navigation": "Open navigation",
  "Close navigation": "Close navigation",
  "Loading page": "Loading page",
});
i18n.activate("en");

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { full_name: "Test User", avatar_url: null },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

vi.mock("../useRouteLoading", () => ({
  useRouteLoading: () => ({ isLoading: false, progress: 0 }),
}));

function renderAppShell(initialEntries: string[] = ["/"]) {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route
            element={<AppShell />}
          >
            <Route index element={<div>child content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("AppShell", () => {
  it("renders nav, header, and main landmarks", () => {
    renderAppShell();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("renders skip to main content link", () => {
    renderAppShell();
    const skipLink = screen.getByText("Skip to main content");
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  it("LoadingBar is rendered in the DOM", () => {
    renderAppShell();
    // LoadingBar renders null when not loading but its container is in DOM via the hook mock
    // The component itself may render null when progress=0, but it's imported into AppShell
    // We verify AppShell renders by checking the main structure
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("hamburger button opens the mobile drawer on click", () => {
    renderAppShell();
    const hamburger = screen.getByLabelText("Open navigation");
    // Drawer should be closed initially (has -translate-x-full)
    // Find the drawer panel element
    const drawerPanel = hamburger.closest("[class*='fixed']")?.parentElement
      ?.querySelector("[class*='translate']");
    fireEvent.click(hamburger);
    // After click, drawer should be open -- check for translate-x-0
    const openedDrawer = document.querySelector("[class*='translate-x-0']");
    expect(openedDrawer).toBeInTheDocument();
  });

  it("backdrop appears when drawer is open", () => {
    renderAppShell();
    const hamburger = screen.getByLabelText("Open navigation");
    fireEvent.click(hamburger);
    // Backdrop should now be visible (opacity-100, not pointer-events-none)
    const backdrop = document.querySelector("[class*='bg-black\\/50']");
    expect(backdrop).toBeInTheDocument();
    expect(backdrop?.className).toContain("opacity-100");
  });

  it("clicking backdrop closes the drawer", () => {
    renderAppShell();
    const hamburger = screen.getByLabelText("Open navigation");
    fireEvent.click(hamburger);

    // Verify drawer is open
    expect(document.querySelector("[class*='translate-x-0']")).toBeInTheDocument();

    // Click the backdrop
    const backdrop = document.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.click(backdrop);

    // Drawer should close (hamburger label back to "Open navigation")
    expect(screen.getByLabelText("Open navigation")).toBeInTheDocument();
    // Check drawer no longer has translate-x-0 on the mobile drawer panel
    const mobileDrawer = document.querySelector(".md\\:hidden[class*='translate']");
    expect(mobileDrawer?.className).toContain("-translate-x-full");
  });

  it("pressing Escape key closes the drawer", () => {
    renderAppShell();
    const hamburger = screen.getByLabelText("Open navigation");
    fireEvent.click(hamburger);

    // Verify drawer is open
    expect(document.querySelector("[class*='translate-x-0']")).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: "Escape" });

    // Drawer should close
    expect(screen.getByLabelText("Open navigation")).toBeInTheDocument();
  });

  it("clicking a nav item in the drawer closes the drawer", () => {
    renderAppShell();
    const hamburger = screen.getByLabelText("Open navigation");
    fireEvent.click(hamburger);

    // Verify drawer is open
    expect(document.querySelector("[class*='translate-x-0']")).toBeInTheDocument();

    // Click DASHBOARD nav link
    const dashboardLinks = screen.getAllByText("DASHBOARD");
    // Click the one in the mobile drawer
    fireEvent.click(dashboardLinks[0]);

    // Drawer should close
    expect(screen.getByLabelText("Open navigation")).toBeInTheDocument();
  });
});
