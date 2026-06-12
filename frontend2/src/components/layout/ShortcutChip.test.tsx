import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShortcutChip } from "./ShortcutChip";

describe("ShortcutChip", () => {
  it("renders a focusable button with the key glyph and an uppercase label", () => {
    render(<ShortcutChip shortcutKey="N" label="New" onActivate={() => {}} />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe("BUTTON");
    // Key glyph is rendered verbatim.
    expect(button).toHaveTextContent("N");
    // Label text is present (uppercase is applied via CSS, DOM keeps source text).
    expect(button).toHaveTextContent(/new/i);
  });

  it("sets aria-keyshortcuts to its key", () => {
    render(<ShortcutChip shortcutKey="F1" label="Help" onActivate={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-keyshortcuts",
      "F1",
    );
  });

  it("invokes the action once when clicked", async () => {
    const onActivate = vi.fn();
    render(<ShortcutChip shortcutKey="N" label="New" onActivate={onActivate} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("applies danger styling when danger=true", () => {
    render(
      <ShortcutChip
        shortcutKey="D"
        label="Delete"
        onActivate={() => {}}
        danger
      />,
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-danger-bg");
    expect(button.className).toContain("text-danger");
  });

  it("applies the blue accent face when current=true", () => {
    render(
      <ShortcutChip
        shortcutKey="N"
        label="New"
        onActivate={() => {}}
        current
      />,
    );
    expect(screen.getByRole("button").className).toContain("bg-titlebar-blue");
  });

  it("uses the panel face by default (neither danger nor current)", () => {
    render(<ShortcutChip shortcutKey="N" label="New" onActivate={() => {}} />);
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("bg-bg-panel");
    expect(cls).not.toContain("bg-titlebar-blue");
    expect(cls).not.toContain("bg-danger-bg");
  });

  it("never uses Silkscreen (font-display) on the chip — Pitfall 6 / hard rule 1", () => {
    const { container } = render(
      <ShortcutChip shortcutKey="N" label="New" onActivate={() => {}} />,
    );
    expect(container.innerHTML).not.toContain("font-display");
  });
});
