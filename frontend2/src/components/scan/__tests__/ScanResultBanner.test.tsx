import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

// Mock formatScanTime so timestamps render deterministically in tests.
vi.mock("@/lib/scanner", () => ({
  formatScanTime: vi.fn(() => "Just now"),
}));

import { ScanResultBanner } from "../ScanResultBanner";
import { formatScanTime } from "@/lib/scanner";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("ScanResultBanner (D-02 post-decode banner)", () => {
  beforeEach(() => {
    vi.mocked(formatScanTime).mockClear();
  });

  afterEach(() => cleanup());

  const defaultProps = {
    code: "ABC-123-XYZ",
    format: "qr_code",
    timestamp: 1700000000000,
    onScanAgain: vi.fn(),
  };

  it("renders a SCANNED heading (Test 1)", () => {
    renderWithI18n(<ScanResultBanner {...defaultProps} onScanAgain={vi.fn()} />);
    const heading = screen.getByRole("heading", { name: /SCANNED/i });
    expect(heading).toBeInTheDocument();
  });

  it("renders CODE label and the code prop in a large monospace element (Test 2)", () => {
    renderWithI18n(
      <ScanResultBanner {...defaultProps} onScanAgain={vi.fn()} />,
    );
    expect(screen.getByText("CODE")).toBeInTheDocument();
    const codeEl = screen.getByText("ABC-123-XYZ");
    expect(codeEl).toBeInTheDocument();
    // Typography contract: monospace + 24px display per UI-SPEC
    expect(codeEl.className).toContain("font-mono");
    expect(codeEl.className).toContain("text-[24px]");
  });

  it("renders FORMAT label and format in an amber pill (Test 3)", () => {
    renderWithI18n(
      <ScanResultBanner {...defaultProps} onScanAgain={vi.fn()} />,
    );
    expect(screen.getByText("FORMAT")).toBeInTheDocument();
    const pill = screen.getByTestId("scan-format-pill");
    expect(pill).toBeInTheDocument();
    expect(pill.textContent).toBe("qr_code");
    expect(pill.className).toContain("bg-retro-amber");
  });

  it("renders the timestamp via formatScanTime(timestamp) (Test 4)", () => {
    renderWithI18n(
      <ScanResultBanner {...defaultProps} onScanAgain={vi.fn()} />,
    );
    expect(formatScanTime).toHaveBeenCalledWith(1700000000000);
    expect(screen.getByText("Just now")).toBeInTheDocument();
  });

  it("renders a SCAN AGAIN primary button; click calls onScanAgain once (Test 5)", async () => {
    const user = userEvent.setup();
    const onScanAgain = vi.fn();
    renderWithI18n(
      <ScanResultBanner {...defaultProps} onScanAgain={onScanAgain} />,
    );
    const btn = screen.getByRole("button", { name: /SCAN AGAIN/i });
    expect(btn).toBeInTheDocument();
    // Primary variant = amber background
    expect(btn.className).toContain("bg-retro-amber");
    await user.click(btn);
    expect(onScanAgain).toHaveBeenCalledTimes(1);
  });

  it("renders inside a RetroPanel with a yellow HazardStripe header (Test 6)", () => {
    const { container } = renderWithI18n(
      <ScanResultBanner {...defaultProps} onScanAgain={vi.fn()} />,
    );
    // HazardStripe sets data-variant attr
    const stripe = container.querySelector('[data-variant="yellow"]');
    expect(stripe).toBeInTheDocument();
    // RetroPanel uses thick ink border + cream background
    const panel = container.querySelector(".border-retro-thick.border-retro-ink");
    expect(panel).toBeInTheDocument();
  });

  it("renders MANUAL format pill when format='MANUAL' (manual-entry path) (Test 7)", () => {
    renderWithI18n(
      <ScanResultBanner
        code="TYPED-001"
        format="MANUAL"
        timestamp={1700000000000}
        onScanAgain={vi.fn()}
      />,
    );
    const pill = screen.getByTestId("scan-format-pill");
    expect(pill.textContent).toBe("MANUAL");
  });
});
