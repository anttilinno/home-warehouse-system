import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { RetroCheckbox } from "./RetroCheckbox";

function wrap(ui: React.ReactNode) {
  return <I18nProvider i18n={i18n}>{ui}</I18nProvider>;
}

describe("RetroCheckbox", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("drives state via an sr-only native checkbox; the visual box is aria-hidden", () => {
    render(wrap(<RetroCheckbox label="Active" />));
    const input = screen.getByRole("checkbox", { name: "Active" });
    expect(input.tagName).toBe("INPUT");
    expect((input as HTMLInputElement).type).toBe("checkbox");
    expect(input.className).toContain("sr-only");
    // The decorative box is present and hidden from AT.
    const box = document.querySelector('[aria-hidden="true"]');
    expect(box).toBeInTheDocument();
  });

  it("shows a ✓ + pressed bevel when checked; clicking the label toggles", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(wrap(<RetroCheckbox label="Active" onChange={onChange} />));
    const input = screen.getByRole("checkbox", {
      name: "Active",
    }) as HTMLInputElement;
    expect(input.checked).toBe(false);
    await user.click(screen.getByText("Active"));
    expect(onChange).toHaveBeenCalled();
    expect(input.checked).toBe(true);
    // visible glyph appears
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("renders the – dash for the indeterminate state", () => {
    render(wrap(<RetroCheckbox label="All" indeterminate />));
    const input = screen.getByRole("checkbox", {
      name: "All",
    }) as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
    expect(screen.getByText("–")).toBeInTheDocument();
  });
});
