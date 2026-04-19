// Phase 65 Plan 65-06 — widened ScanResultBanner state contract (D-17..D-21).
// Four mutually-exclusive states driven by lookupStatus + match:
//   LOADING (D-20)  — lookupStatus="loading"
//   MATCH   (D-18)  — lookupStatus="success" + match !== null
//   NOT-FOUND(D-19) — lookupStatus="success" + match === null
//   ERROR   (D-21)  — lookupStatus="error"
//
// These tests turn the Plan 65-01 scaffold it.todo into real assertions.
// The 21st test is a dual-state-absence sweep (T-65-06-03) asserting
// exactly one heading renders per state across the full state matrix.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

// Mock formatScanTime so timestamps render deterministically.
vi.mock("@/lib/scanner", () => ({
  formatScanTime: vi.fn(() => "Just now"),
}));

import { ScanResultBanner } from "../ScanResultBanner";
import type { Item } from "@/lib/api/items";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

afterEach(() => cleanup());

const matchItem: Item = {
  id: "item-42",
  workspace_id: "ws-1",
  sku: "SKU-042",
  name: "Coca-Cola 330ml",
  short_code: "CC3-A1",
  barcode: "5449000000996",
  min_stock_level: 0,
  created_at: "2026-04-19T00:00:00Z",
  updated_at: "2026-04-19T00:00:00Z",
};

function baseCallbacks() {
  return {
    onScanAgain: vi.fn(),
    onViewItem: vi.fn(),
    onCreateWithBarcode: vi.fn(),
    onRetry: vi.fn(),
  };
}

function loadingProps() {
  return {
    code: "5449000000996",
    format: "ean_13",
    timestamp: 1700000000000,
    lookupStatus: "loading" as const,
    match: null,
    ...baseCallbacks(),
  };
}

function matchProps() {
  return {
    code: "5449000000996",
    format: "ean_13",
    timestamp: 1700000000000,
    lookupStatus: "success" as const,
    match: matchItem,
    ...baseCallbacks(),
  };
}

function notFoundProps() {
  return {
    code: "5449000000996",
    format: "ean_13",
    timestamp: 1700000000000,
    lookupStatus: "success" as const,
    match: null,
    ...baseCallbacks(),
  };
}

function errorProps() {
  return {
    code: "5449000000996",
    format: "ean_13",
    timestamp: 1700000000000,
    lookupStatus: "error" as const,
    match: null,
    ...baseCallbacks(),
  };
}

describe("ScanResultBanner LOADING state (D-20)", () => {
  it("D-20: lookupStatus=\"loading\" renders h2 t`LOOKING UP…`", () => {
    renderWithI18n(<ScanResultBanner {...loadingProps()} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toContain("LOOKING UP…");
  });

  it("D-20: LOADING renders dimmed code echo (text-retro-charcoal/60)", () => {
    renderWithI18n(<ScanResultBanner {...loadingProps()} />);
    const codeEl = screen.getByText("5449000000996");
    expect(codeEl.className).toContain("text-retro-charcoal/60");
  });

  it("D-20: LOADING renders SCAN AGAIN button AS INTERACTIVE (not disabled)", () => {
    renderWithI18n(<ScanResultBanner {...loadingProps()} />);
    const btn = screen.getByRole("button", { name: /SCAN AGAIN/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toHaveAttribute("disabled");
  });

  it("D-20: LOADING renders a blinking cursor glyph ▍ with class that maps to @keyframes retro-cursor-blink", () => {
    const { container } = renderWithI18n(
      <ScanResultBanner {...loadingProps()} />,
    );
    const cursor = container.querySelector(".retro-cursor-blink");
    expect(cursor).not.toBeNull();
    expect(cursor?.textContent).toContain("▍");
  });

  it("D-20: LOADING does NOT render a hazard stripe", () => {
    const { container } = renderWithI18n(
      <ScanResultBanner {...loadingProps()} />,
    );
    const stripe = container.querySelector("[data-variant]");
    expect(stripe).toBeNull();
  });
});

describe("ScanResultBanner MATCH state (D-18)", () => {
  it("D-18: lookupStatus=\"success\" + match!=null renders h2 t`MATCHED`", () => {
    renderWithI18n(<ScanResultBanner {...matchProps()} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toContain("MATCHED");
  });

  it("D-18: MATCH renders t`NAME` label + match.name value (24px mono bold)", () => {
    renderWithI18n(<ScanResultBanner {...matchProps()} />);
    expect(screen.getByText("NAME")).toBeInTheDocument();
    const value = screen.getByText("Coca-Cola 330ml");
    expect(value.className).toContain("font-mono");
    expect(value.className).toContain("font-bold");
    expect(value.className).toContain("text-[24px]");
  });

  it("D-18: MATCH renders t`CODE` label + match.short_code value (mono)", () => {
    renderWithI18n(<ScanResultBanner {...matchProps()} />);
    expect(screen.getByText("CODE")).toBeInTheDocument();
    const shortCode = screen.getByText("CC3-A1");
    expect(shortCode.className).toContain("font-mono");
  });

  it("D-18: MATCH VIEW ITEM button onClick calls onViewItem(match.id)", async () => {
    const user = userEvent.setup();
    const props = matchProps();
    renderWithI18n(<ScanResultBanner {...props} />);
    const btn = screen.getByRole("button", { name: /VIEW ITEM/i });
    await user.click(btn);
    expect(props.onViewItem).toHaveBeenCalledWith("item-42");
    expect(props.onViewItem).toHaveBeenCalledTimes(1);
  });

  it("D-18: MATCH also renders SCAN AGAIN", () => {
    renderWithI18n(<ScanResultBanner {...matchProps()} />);
    expect(
      screen.getByRole("button", { name: /SCAN AGAIN/i }),
    ).toBeInTheDocument();
  });
});

describe("ScanResultBanner NOT-FOUND state (D-19)", () => {
  it("D-19: lookupStatus=\"success\" + match===null renders yellow HazardStripe", () => {
    const { container } = renderWithI18n(
      <ScanResultBanner {...notFoundProps()} />,
    );
    const stripe = container.querySelector('[data-variant="yellow"]');
    expect(stripe).not.toBeNull();
  });

  it("D-19: NOT-FOUND renders h2 t`NOT FOUND`", () => {
    renderWithI18n(<ScanResultBanner {...notFoundProps()} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toContain("NOT FOUND");
  });

  it("D-19: NOT-FOUND renders helper line t`No item in this workspace matches this barcode.`", () => {
    renderWithI18n(<ScanResultBanner {...notFoundProps()} />);
    expect(
      screen.getByText("No item in this workspace matches this barcode."),
    ).toBeInTheDocument();
  });

  it("D-19: NOT-FOUND CREATE ITEM WITH THIS BARCODE button onClick calls onCreateWithBarcode(code)", async () => {
    const user = userEvent.setup();
    const props = notFoundProps();
    renderWithI18n(<ScanResultBanner {...props} />);
    const btn = screen.getByRole("button", {
      name: /CREATE ITEM WITH THIS BARCODE/i,
    });
    await user.click(btn);
    expect(props.onCreateWithBarcode).toHaveBeenCalledWith("5449000000996");
    expect(props.onCreateWithBarcode).toHaveBeenCalledTimes(1);
  });

  it("D-19: NOT-FOUND also renders SCAN AGAIN", () => {
    renderWithI18n(<ScanResultBanner {...notFoundProps()} />);
    expect(
      screen.getByRole("button", { name: /SCAN AGAIN/i }),
    ).toBeInTheDocument();
  });
});

describe("ScanResultBanner ERROR state (D-21)", () => {
  it("D-21: lookupStatus=\"error\" renders red HazardStripe", () => {
    const { container } = renderWithI18n(
      <ScanResultBanner {...errorProps()} />,
    );
    const stripe = container.querySelector('[data-variant="red"]');
    expect(stripe).not.toBeNull();
  });

  it("D-21: ERROR renders h2 t`LOOKUP FAILED`", () => {
    renderWithI18n(<ScanResultBanner {...errorProps()} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toContain("LOOKUP FAILED");
  });

  it("D-21: ERROR RETRY button onClick calls onRetry", async () => {
    const user = userEvent.setup();
    const props = errorProps();
    renderWithI18n(<ScanResultBanner {...props} />);
    const btn = screen.getByRole("button", { name: /^RETRY$/i });
    await user.click(btn);
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("D-21: ERROR also renders CREATE ITEM WITH THIS BARCODE fallback", () => {
    renderWithI18n(<ScanResultBanner {...errorProps()} />);
    expect(
      screen.getByRole("button", { name: /CREATE ITEM WITH THIS BARCODE/i }),
    ).toBeInTheDocument();
  });

  it("D-21: ERROR also renders SCAN AGAIN", () => {
    renderWithI18n(<ScanResultBanner {...errorProps()} />);
    expect(
      screen.getByRole("button", { name: /SCAN AGAIN/i }),
    ).toBeInTheDocument();
  });
});

describe("ScanResultBanner dual-state absence sweep (T-65-06-03)", () => {
  it("exactly one of {LOOKING UP…, MATCHED, NOT FOUND, LOOKUP FAILED} renders per state — never two", () => {
    const headings = [
      "LOOKING UP…",
      "MATCHED",
      "NOT FOUND",
      "LOOKUP FAILED",
    ] as const;
    const cases = [
      { label: "loading", props: loadingProps(), expected: "LOOKING UP…" },
      { label: "match", props: matchProps(), expected: "MATCHED" },
      { label: "not-found", props: notFoundProps(), expected: "NOT FOUND" },
      { label: "error", props: errorProps(), expected: "LOOKUP FAILED" },
    ];
    for (const { label, props, expected } of cases) {
      const { container, unmount } = renderWithI18n(
        <ScanResultBanner {...props} />,
      );
      const h2 = container.querySelector("h2");
      expect(h2, `${label}: h2 must exist`).not.toBeNull();
      const text = h2!.textContent ?? "";
      for (const h of headings) {
        if (h === expected) {
          expect(text, `${label}: expected ${h}`).toContain(h);
        } else {
          expect(text, `${label}: must NOT contain ${h}`).not.toContain(h);
        }
      }
      unmount();
    }
  });
});
