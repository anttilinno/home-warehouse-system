import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ScanTorchToggle } from "./ScanTorchToggle";

function renderTorch(ui: React.ReactNode) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

afterEach(() => {
  cleanup();
});

describe("ScanTorchToggle", () => {
  it("renders NOTHING when torch is unsupported (iOS auto-hide, SCAN-04)", () => {
    const { container } = renderTorch(
      <ScanTorchToggle supported={false} enabled={false} onToggle={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a button when supported", () => {
    renderTorch(
      <ScanTorchToggle supported={true} enabled={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("OFF state: shows TORCH word, glyph, and aria-pressed=false", () => {
    renderTorch(
      <ScanTorchToggle supported={true} enabled={false} onToggle={vi.fn()} />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("TORCH");
    expect(btn).not.toHaveTextContent("TORCH ON");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveTextContent("⚡");
  });

  it("ON state: shows TORCH ON word and aria-pressed=true", () => {
    renderTorch(
      <ScanTorchToggle supported={true} enabled={true} onToggle={vi.fn()} />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("TORCH ON");
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("meets the 44x44 touch floor", () => {
    renderTorch(
      <ScanTorchToggle supported={true} enabled={false} onToggle={vi.fn()} />,
    );
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("min-h-[44px]");
    expect(btn.className).toContain("min-w-[44px]");
  });

  it("calls onToggle when clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderTorch(
      <ScanTorchToggle supported={true} enabled={false} onToggle={onToggle} />,
    );
    await user.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
