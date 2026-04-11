import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { ErrorBoundaryPage } from "../ErrorBoundaryPage";

// Mock useRouteError and useNavigate from react-router
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useRouteError: vi.fn(() => null),
    useNavigate: vi.fn(() => vi.fn()),
  };
});

function renderErrorBoundaryPage(error?: string) {
  return render(
    <MemoryRouter>
      <ErrorBoundaryPage error={error} />
    </MemoryRouter>
  );
}

describe("ErrorBoundaryPage", () => {
  it("renders 'SYSTEM ERROR' heading in uppercase", () => {
    renderErrorBoundaryPage();
    expect(screen.getByText("SYSTEM ERROR")).toBeInTheDocument();
  });

  it("renders error message in monospace font", () => {
    renderErrorBoundaryPage("Test error message");
    const errorEl = screen.getByText("Test error message");
    expect(errorEl.className).toContain("font-mono");
  });

  it("renders 'RETURN TO BASE' button", () => {
    renderErrorBoundaryPage();
    expect(screen.getByRole("button", { name: /RETURN TO BASE/i })).toBeInTheDocument();
  });

  it("renders a RetroPanel with HazardStripe (has bg-retro-charcoal background)", () => {
    const { container } = renderErrorBoundaryPage();
    // The outer wrapper should have bg-retro-charcoal
    const charcoalEl = container.querySelector(".bg-retro-charcoal");
    expect(charcoalEl).toBeInTheDocument();
  });

  it("has charcoal background (bg-retro-charcoal)", () => {
    const { container } = renderErrorBoundaryPage();
    expect(container.querySelector(".bg-retro-charcoal")).toBeInTheDocument();
  });
});
