import { render, screen } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { vi } from "vitest";
import { LoadingBar } from "../LoadingBar";

// Setup lingui for tests
i18n.load("en", {});
i18n.activate("en");

vi.mock("../useRouteLoading", () => ({
  useRouteLoading: vi.fn(),
}));

import { useRouteLoading } from "../useRouteLoading";

const mockUseRouteLoading = vi.mocked(useRouteLoading);

function renderLoadingBar() {
  return render(
    <I18nProvider i18n={i18n}>
      <LoadingBar />
    </I18nProvider>
  );
}

describe("LoadingBar", () => {
  it("renders nothing when not loading (isLoading=false, progress=0)", () => {
    mockUseRouteLoading.mockReturnValue({ isLoading: false, progress: 0 });
    const { container } = renderLoadingBar();
    expect(container.firstChild).toBeNull();
  });

  it("renders a div with role='progressbar' when loading", () => {
    mockUseRouteLoading.mockReturnValue({ isLoading: true, progress: 90 });
    renderLoadingBar();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("has aria-label 'Loading page'", () => {
    mockUseRouteLoading.mockReturnValue({ isLoading: true, progress: 90 });
    renderLoadingBar();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-label", "Loading page");
  });

  it("has class bg-retro-amber and z-40", () => {
    mockUseRouteLoading.mockReturnValue({ isLoading: true, progress: 90 });
    renderLoadingBar();
    const bar = screen.getByRole("progressbar");
    expect(bar.className).toContain("bg-retro-amber");
    expect(bar.className).toContain("z-40");
  });
});
