import { screen } from "@testing-library/react";
import { renderWithRouter } from "@/test-utils";
import { Sidebar } from "../Sidebar";

describe("Sidebar", () => {
  it("renders a nav element with aria-label 'Main navigation'", () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
  });

  it("renders two NavLinks with text DASHBOARD and SETTINGS", () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText("DASHBOARD")).toBeInTheDocument();
    expect(screen.getByText("SETTINGS")).toBeInTheDocument();
  });

  it("Dashboard NavLink has to='/' and Settings NavLink has to='/settings'", () => {
    renderWithRouter(<Sidebar />);
    const dashboard = screen.getByText("DASHBOARD").closest("a");
    const settings = screen.getByText("SETTINGS").closest("a");
    expect(dashboard).toHaveAttribute("href", "/");
    expect(settings).toHaveAttribute("href", "/settings");
  });

  it("active NavLink (Dashboard at /) has class bg-retro-amber and shadow-retro-pressed", () => {
    renderWithRouter(<Sidebar />, { initialEntries: ["/"] });
    const dashboard = screen.getByText("DASHBOARD").closest("a");
    expect(dashboard?.className).toContain("bg-retro-amber");
    expect(dashboard?.className).toContain("shadow-retro-pressed");
  });

  it("inactive NavLink has class bg-retro-cream and shadow-retro-raised", () => {
    renderWithRouter(<Sidebar />, { initialEntries: ["/"] });
    const settings = screen.getByText("SETTINGS").closest("a");
    expect(settings?.className).toContain("bg-retro-cream");
    expect(settings?.className).toContain("shadow-retro-raised");
  });

  it("active NavLink (Settings at /settings) has class bg-retro-amber and shadow-retro-pressed", () => {
    renderWithRouter(<Sidebar />, { initialEntries: ["/settings"] });
    const settings = screen.getByText("SETTINGS").closest("a");
    expect(settings?.className).toContain("bg-retro-amber");
    expect(settings?.className).toContain("shadow-retro-pressed");
  });

  it("NavLinks have retro styling classes: border-retro-thick, border-retro-ink, font-bold, uppercase", () => {
    renderWithRouter(<Sidebar />);
    const dashboard = screen.getByText("DASHBOARD").closest("a");
    expect(dashboard?.className).toContain("border-retro-thick");
    expect(dashboard?.className).toContain("border-retro-ink");
    expect(dashboard?.className).toContain("font-bold");
    expect(dashboard?.className).toContain("uppercase");
  });
});
