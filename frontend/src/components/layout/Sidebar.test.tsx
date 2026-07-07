import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { Sidebar } from "./Sidebar";
import type { DashboardStats, User } from "@/lib/types";

// NavLink reads the router location, so every render needs a MemoryRouter; the
// i18n singleton lets <Trans> resolve to its source message.
function renderSidebar(
  ui: React.ReactElement,
  { route = "/" }: { route?: string } = {},
) {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </I18nProvider>,
  );
}

const stats: DashboardStats = {
  total_items: 12,
  total_locations: 3,
  total_containers: 4,
  total_categories: 5,
  active_loans: 2,
  total_borrowers: 6,
} as DashboardStats;

const user: User = {
  id: "u1",
  email: "seeder@test.local",
  full_name: "Seed Er",
} as User;

describe("Sidebar", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the OVERVIEW / INVENTORY / PLANNING / SYSTEM group labels", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />);
    // Target the group HEADINGS specifically — "Inventory" also appears as a
    // NavItem label in the INVENTORY group, so a bare getByText is ambiguous.
    expect(
      screen.getByRole("heading", { name: "Overview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Inventory" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Planning" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "System" })).toBeInTheDocument();
  });

  it("marks the Dashboard nav item active (aria-current + active bevel) at '/'", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />, { route: "/" });
    const dashboard = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboard).toHaveAttribute("aria-current", "page");
    expect(dashboard.className).toContain("bg-selection-fill");
    expect(dashboard.className).toContain("border-border-ink");
    expect(dashboard.className).toContain("shadow-hard-ink");
  });

  it("does NOT mark Dashboard active when on a different route", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />, { route: "/items" });
    const dashboard = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboard).not.toHaveAttribute("aria-current", "page");
    expect(dashboard.className).not.toContain("bg-selection-fill");
  });

  it("marks ONLY the matching ?tab taxonomy item active (not all three)", () => {
    // All three point at /taxonomy with a different ?tab — NavLink would mark
    // them all active; the tab-aware matcher must pick exactly one.
    renderSidebar(<Sidebar stats={stats} user={user} />, {
      route: "/taxonomy?tab=locations",
    });
    const locations = screen.getByRole("link", { name: /locations/i });
    const containers = screen.getByRole("link", { name: /containers/i });
    const categories = screen.getByRole("link", { name: /categories/i });
    expect(locations).toHaveAttribute("aria-current", "page");
    expect(containers).not.toHaveAttribute("aria-current", "page");
    expect(categories).not.toHaveAttribute("aria-current", "page");
  });

  it("keeps Categories active on a taxonomy sub-route (/taxonomy/categories/new)", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />, {
      route: "/taxonomy/categories/new",
    });
    expect(screen.getByRole("link", { name: /categories/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /locations/i }),
    ).not.toHaveAttribute("aria-current", "page");
  });

  it("defaults /taxonomy (no ?tab) to the Categories item", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />, {
      route: "/taxonomy",
    });
    expect(screen.getByRole("link", { name: /categories/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /locations/i }),
    ).not.toHaveAttribute("aria-current", "page");
  });

  it("wires the Settings nav item to /settings (Phase 14 — no longer disabled)", () => {
    // Settings was disabled until Phase 14; 14-08 folds the still-unwired
    // Settings nav into the System group and points it at /settings.
    renderSidebar(<Sidebar stats={stats} user={user} />);
    const settings = screen.getByRole("link", { name: /settings/i });
    expect(settings).toHaveAttribute("href", "/settings");
    expect(settings).not.toHaveAttribute("aria-disabled");
  });

  it("wires the six Phase-14 System nav items to their routes", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />);
    expect(screen.getByRole("link", { name: /approvals/i })).toHaveAttribute(
      "href",
      "/approvals",
    );
    expect(screen.getByRole("link", { name: /my changes/i })).toHaveAttribute(
      "href",
      "/my-changes",
    );
    expect(screen.getByRole("link", { name: /wishlist/i })).toHaveAttribute(
      "href",
      "/wishlist",
    );
    expect(screen.getByRole("link", { name: /declutter/i })).toHaveAttribute(
      "href",
      "/declutter",
    );
    expect(screen.getByRole("link", { name: /imports/i })).toHaveAttribute(
      "href",
      "/imports",
    );
    expect(screen.getByRole("link", { name: /sync history/i })).toHaveAttribute(
      "href",
      "/sync-history",
    );
  });

  it("carries .nav-label / .nav-count rail-mode hook classes", () => {
    const { container } = renderSidebar(<Sidebar stats={stats} user={user} />);
    expect(container.querySelector(".nav-label")).not.toBeNull();
    expect(container.querySelector(".nav-count")).not.toBeNull();
  });

  it("renders a badge-dot element for nav items that carry a count", () => {
    const { container } = renderSidebar(<Sidebar stats={stats} user={user} />);
    // The Items nav item has a count → a rail-mode badge dot hook is present.
    expect(container.querySelector(".nav-badge-dot")).not.toBeNull();
  });

  it("renders a collapse toggle button in the Navigator titlebar actions slot", () => {
    const onToggle = vi.fn();
    renderSidebar(
      <Sidebar stats={stats} user={user} onToggleCollapse={onToggle} />,
    );
    const toggle = screen.getByRole("button", { name: /collapse|expand/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("sets the collapse toggle aria-expanded=false when collapsed", () => {
    renderSidebar(<Sidebar stats={stats} user={user} collapsed />);
    const toggle = screen.getByRole("button", { name: /collapse|expand/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
