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

  it("renders the OVERVIEW / INVENTORY / SYSTEM group labels", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />);
    // Target the group HEADINGS specifically — "Inventory" also appears as a
    // NavItem label in the INVENTORY group, so a bare getByText is ambiguous.
    expect(
      screen.getByRole("heading", { name: "Overview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Inventory" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "System" })).toBeInTheDocument();
  });

  it("marks the Dashboard nav item active (aria-current + active bevel) at '/'", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />, { route: "/" });
    const dashboard = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboard).toHaveAttribute("aria-current", "page");
    expect(dashboard.className).toContain("bg-titlebar-blue");
    expect(dashboard.className).toContain("border-border-ink");
    expect(dashboard.className).toContain("shadow-hard-ink");
  });

  it("does NOT mark Dashboard active when on a different route", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />, { route: "/items" });
    const dashboard = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboard).not.toHaveAttribute("aria-current", "page");
    expect(dashboard.className).not.toContain("bg-titlebar-blue");
  });

  it("renders a not-built nav item as aria-disabled with the 'Not built yet' title", () => {
    renderSidebar(<Sidebar stats={stats} user={user} />);
    // Analytics has no `to` this phase.
    const analytics = screen.getByText("Analytics").closest("[aria-disabled]");
    expect(analytics).not.toBeNull();
    expect(analytics).toHaveAttribute("aria-disabled", "true");
    expect(analytics).toHaveAttribute("title", "Not built yet");
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
