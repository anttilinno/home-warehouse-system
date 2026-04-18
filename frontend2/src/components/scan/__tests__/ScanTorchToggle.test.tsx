import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { ScanTorchToggle } from "../ScanTorchToggle";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("ScanTorchToggle (SCAN-04 rendered path, D-16)", () => {
  afterEach(() => cleanup());

  it("renders TORCH OFF label + [◉] glyph when torchOn=false (Test 1)", () => {
    renderWithI18n(<ScanTorchToggle torchOn={false} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toContain("TORCH OFF");
    expect(btn.textContent).toContain("[◉]");
  });

  it("renders TORCH ON label + [◉] glyph when torchOn=true (Test 2)", () => {
    renderWithI18n(<ScanTorchToggle torchOn={true} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toContain("TORCH ON");
    expect(btn.textContent).toContain("[◉]");
  });

  it("aria-pressed reflects torchOn state (Test 3)", () => {
    const { rerender } = renderWithI18n(
      <ScanTorchToggle torchOn={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
    rerender(
      <I18nProvider i18n={i18n}>
        <ScanTorchToggle torchOn={true} onToggle={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
  });

  it("tapping the button invokes onToggle exactly once; no call on render (Test 4)", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderWithI18n(<ScanTorchToggle torchOn={false} onToggle={onToggle} />);
    expect(onToggle).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("ON state applies primary variant (bg-retro-amber), OFF applies neutral (Test 5)", () => {
    const { rerender } = renderWithI18n(
      <ScanTorchToggle torchOn={false} onToggle={vi.fn()} />,
    );
    // OFF state uses neutral variant — cream background
    expect(screen.getByRole("button").className).toContain("bg-retro-cream");
    rerender(
      <I18nProvider i18n={i18n}>
        <ScanTorchToggle torchOn={true} onToggle={vi.fn()} />
      </I18nProvider>,
    );
    // ON state uses primary variant — amber background
    expect(screen.getByRole("button").className).toContain("bg-retro-amber");
  });
});
