import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { LoadingBar } from "../LoadingBar";

vi.mock("../useRouteLoading", () => ({
  useRouteLoading: vi.fn(),
}));

import { useRouteLoading } from "../useRouteLoading";

const mockUseRouteLoading = vi.mocked(useRouteLoading);

describe("LoadingBar", () => {
  it("renders nothing when not loading (isLoading=false, progress=0)", () => {
    mockUseRouteLoading.mockReturnValue({ isLoading: false, progress: 0 });
    const { container } = render(<LoadingBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a div with role='progressbar' when loading", () => {
    mockUseRouteLoading.mockReturnValue({ isLoading: true, progress: 90 });
    render(<LoadingBar />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("has aria-label 'Loading page'", () => {
    mockUseRouteLoading.mockReturnValue({ isLoading: true, progress: 90 });
    render(<LoadingBar />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-label", "Loading page");
  });

  it("has class bg-retro-amber and z-40", () => {
    mockUseRouteLoading.mockReturnValue({ isLoading: true, progress: 90 });
    render(<LoadingBar />);
    const bar = screen.getByRole("progressbar");
    expect(bar.className).toContain("bg-retro-amber");
    expect(bar.className).toContain("z-40");
  });
});
