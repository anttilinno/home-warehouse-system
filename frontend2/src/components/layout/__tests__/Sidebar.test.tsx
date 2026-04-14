import { screen } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Sidebar } from "../Sidebar";

// Setup lingui for tests
i18n.load("en", {});
i18n.activate("en");

function renderSidebar(initialEntries: string[] = ["/"]) {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={initialEntries}>
        <Sidebar />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("Sidebar", () => {
  it("renders a nav element with aria-label 'Main navigation'", () => {
    renderSidebar();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
  });

  it("renders two NavLinks with text DASHBOARD and SETTINGS", () => {
    renderSidebar();
    expect(screen.getByText("DASHBOARD")).toBeInTheDocument();
    expect(screen.getByText("ITEMS")).toBeInTheDocument();
    expect(screen.getByText("LOANS")).toBeInTheDocument();
    expect(screen.getByText("SETTINGS")).toBeInTheDocument();
  });

  it("Dashboard NavLink has to='/' and Settings NavLink has to='/settings'", () => {
    renderSidebar();
    const dashboard = screen.getByText("DASHBOARD").closest("a");
    const items = screen.getByText("ITEMS").closest("a");
    const loans = screen.getByText("LOANS").closest("a");
    const settings = screen.getByText("SETTINGS").closest("a");
    expect(dashboard).toHaveAttribute("href", "/");
    expect(items).toHaveAttribute("href", "/items");
    expect(loans).toHaveAttribute("href", "/loans");
    expect(settings).toHaveAttribute("href", "/settings");
  });

  it("active NavLink (Dashboard at /) has class bg-retro-amber and shadow-retro-pressed", () => {
    renderSidebar(["/"]);
    const dashboard = screen.getByText("DASHBOARD").closest("a");
    expect(dashboard?.className).toContain("bg-retro-amber");
    expect(dashboard?.className).toContain("shadow-retro-pressed");
  });

  it("inactive NavLink has class bg-retro-cream and shadow-retro-raised", () => {
    renderSidebar(["/"]);
    const settings = screen.getByText("SETTINGS").closest("a");
    expect(settings?.className).toContain("bg-retro-cream");
    expect(settings?.className).toContain("shadow-retro-raised");
  });

  it("active NavLink (Settings at /settings) has class bg-retro-amber and shadow-retro-pressed", () => {
    renderSidebar(["/settings"]);
    const settings = screen.getByText("SETTINGS").closest("a");
    expect(settings?.className).toContain("bg-retro-amber");
    expect(settings?.className).toContain("shadow-retro-pressed");
  });

  it("active NavLink (Items at /items) has class bg-retro-amber and shadow-retro-pressed", () => {
    renderSidebar(["/items"]);
    const items = screen.getByText("ITEMS").closest("a");
    expect(items?.className).toContain("bg-retro-amber");
    expect(items?.className).toContain("shadow-retro-pressed");
  });

  it("active NavLink (Loans at /loans) has class bg-retro-amber and shadow-retro-pressed", () => {
    renderSidebar(["/loans"]);
    const loans = screen.getByText("LOANS").closest("a");
    expect(loans?.className).toContain("bg-retro-amber");
    expect(loans?.className).toContain("shadow-retro-pressed");
  });

  it("NavLinks have retro styling classes: border-retro-thick, border-retro-ink, font-bold, uppercase", () => {
    renderSidebar();
    const dashboard = screen.getByText("DASHBOARD").closest("a");
    expect(dashboard?.className).toContain("border-retro-thick");
    expect(dashboard?.className).toContain("border-retro-ink");
    expect(dashboard?.className).toContain("font-bold");
    expect(dashboard?.className).toContain("uppercase");
  });
});
