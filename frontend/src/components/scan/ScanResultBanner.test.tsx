import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ScanResultBanner } from "./ScanResultBanner";
import type { Item } from "@/lib/types";

function renderBanner(ui: React.ReactElement) {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nProvider>,
  );
}

const item = { id: "it-1", name: "Cordless Drill" } as Item;

describe("ScanResultBanner", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("LOADING renders the word + ◌ glyph + a blinking cursor with the code", () => {
    renderBanner(<ScanResultBanner status="loading" code="0123456789012" />);
    expect(screen.getByText("LOADING")).toBeInTheDocument();
    expect(screen.getByText("◌")).toBeInTheDocument();
    expect(screen.getByText("0123456789012")).toBeInTheDocument();
    // The cursor carries the shared motion class (reduced-motion handled in CSS).
    expect(screen.getByTestId("scan-cursor")).toHaveClass("scan-cursor--blink");
  });

  it("MATCH renders the word, ✓, item name and an ACTIONS button", async () => {
    const onOpenActions = vi.fn();
    renderBanner(
      <ScanResultBanner
        status="match"
        code="0123456789012"
        item={item}
        onOpenActions={onOpenActions}
      />,
    );
    expect(screen.getByText("MATCH")).toBeInTheDocument();
    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText("Cordless Drill")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /ACTIONS/ }));
    expect(onOpenActions).toHaveBeenCalledOnce();
  });

  it("NOT-FOUND renders the word, ✕ and an encoded CREATE WITH CODE link", () => {
    renderBanner(<ScanResultBanner status="not-found" code="abc/../x?y=1" />);
    expect(screen.getByText("NOT FOUND")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /CREATE WITH CODE/ });
    // encodeURIComponent — Pitfall 5 / T-11-08: the code is escaped, no raw slash.
    expect(link).toHaveAttribute(
      "href",
      `/items/new?barcode=${encodeURIComponent("abc/../x?y=1")}`,
    );
    expect(link.getAttribute("href")).not.toContain("abc/../x");
  });

  it("ERROR renders the word, an error sentence and a TRY AGAIN button", async () => {
    const onRetry = vi.fn();
    renderBanner(
      <ScanResultBanner
        status="error"
        code="0123456789012"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText("ERROR")).toBeInTheDocument();
    expect(screen.getByText(/Couldn't look up that code/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /TRY AGAIN/ }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("non-loading states render no blinking cursor", () => {
    renderBanner(
      <ScanResultBanner status="match" code="0123456789012" item={item} />,
    );
    expect(screen.queryByTestId("scan-cursor")).toBeNull();
  });
});
