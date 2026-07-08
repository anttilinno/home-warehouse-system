import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  // Group open/closed state persists in localStorage; isolate each test.
  beforeEach(() => {
    localStorage.clear();
  });

  // Planning + System start collapsed (Plan 1D); expand a group by clicking its
  // header button so its rows render before we assert on them.
  async function expandGroup(name: RegExp) {
    await userEvent.click(screen.getByRole("button", { name }));
  }

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

  it("merges the three taxonomy tabs into a single Organize item", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />);
    expect(screen.getByRole("link", { name: /organize/i })).toHaveAttribute(
      "href",
      "/taxonomy",
    );
    // The individual tab entries no longer live in the nav (palette owns them).
    expect(screen.queryByRole("link", { name: /^locations$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^containers$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^categories$/i })).toBeNull();
  });

  it("marks Organize active anywhere under /taxonomy (any tab / sub-route)", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />, {
      route: "/taxonomy?tab=locations",
    });
    expect(screen.getByRole("link", { name: /organize/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps Organize active on a taxonomy sub-route (/taxonomy/categories/new)", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />, {
      route: "/taxonomy/categories/new",
    });
    expect(screen.getByRole("link", { name: /organize/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("wires the Settings nav item to /settings (Phase 14 — no longer disabled)", async () => {
    // Settings was disabled until Phase 14; 14-08 folds the still-unwired
    // Settings nav into the System group and points it at /settings.
    renderSidebar(<Sidebar stats={stats} user={user} />);
    await expandGroup(/^system$/i);
    const settings = screen.getByRole("link", { name: /settings/i });
    expect(settings).toHaveAttribute("href", "/settings");
    expect(settings).not.toHaveAttribute("aria-disabled");
  });

  it("wires the Planning + System nav items to their routes", async () => {
    renderSidebar(<Sidebar stats={stats} user={user} />);
    // Both groups start collapsed (Plan 1D) — expand before asserting rows.
    await expandGroup(/^planning$/i);
    await expandGroup(/^system$/i);
    expect(screen.getByRole("link", { name: /wishlist/i })).toHaveAttribute(
      "href",
      "/wishlist",
    );
    expect(screen.getByRole("link", { name: /declutter/i })).toHaveAttribute(
      "href",
      "/declutter",
    );
    expect(screen.getByRole("link", { name: /approvals/i })).toHaveAttribute(
      "href",
      "/approvals",
    );
    expect(screen.getByRole("link", { name: /my changes/i })).toHaveAttribute(
      "href",
      "/my-changes",
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
    renderSidebar(
      <Sidebar
        stats={stats}
        user={user}
        collapsed
        onToggleCollapse={vi.fn()}
      />,
    );
    const toggle = screen.getByRole("button", { name: /collapse|expand/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("omits the collapse toggle when no onToggleCollapse is provided (drawer)", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />);
    expect(
      screen.queryByRole("button", { name: /collapse|expand/i }),
    ).toBeNull();
  });

  it("starts with Planning + System collapsed and Overview + Inventory open", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />);
    // Group headers are buttons carrying aria-expanded.
    expect(screen.getByRole("button", { name: /^overview$/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: /^system$/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    // A collapsed group's rows are not in the DOM.
    expect(screen.queryByRole("link", { name: /sync history/i })).toBeNull();
    // An open group's rows are.
    expect(screen.getByRole("link", { name: /^items/i })).toBeInTheDocument();
  });

  it("toggles a group open and closed on header click", async () => {
    renderSidebar(<Sidebar stats={stats} user={user} />);
    const header = screen.getByRole("button", { name: /^planning$/i });
    expect(screen.queryByRole("link", { name: /wishlist/i })).toBeNull();
    await userEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /wishlist/i })).toBeInTheDocument();
    await userEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("persists a group's open state to localStorage across remounts", async () => {
    const { unmount } = renderSidebar(<Sidebar stats={stats} user={user} />);
    await expandGroup(/^system$/i);
    unmount();
    // Remount: the persisted open state re-hydrates.
    renderSidebar(<Sidebar stats={stats} user={user} />);
    expect(screen.getByRole("button", { name: /^system$/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("forces a collapsed group open when the active route lives inside it", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />, {
      route: "/settings",
    });
    expect(screen.getByRole("button", { name: /^system$/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders no count badge for a zero-count stat", () => {
    const zeroStats = { ...stats, active_loans: 0 } as DashboardStats;
    renderSidebar(<Sidebar stats={zeroStats} user={user} />);
    const loans = screen.getByRole("link", { name: /loans/i });
    // Items (12) keeps its count; Loans (0) drops it.
    expect(loans.querySelector(".nav-count")).toBeNull();
    expect(
      screen.getByRole("link", { name: /^items/i }).querySelector(".nav-count"),
    ).not.toBeNull();
  });

  it("shows the pending-approvals count on the collapsed System header", () => {
    renderSidebar(<Sidebar stats={stats} user={user} pendingApprovals={3} />);
    // System is collapsed by default; the pending count rides its header so it
    // is never hidden.
    expect(
      screen.getByRole("button", { name: /system.*3|3.*system/i }),
    ).toBeInTheDocument();
  });
});
