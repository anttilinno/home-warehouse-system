import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import { ShowArchivedChip } from "../filters/ShowArchivedChip";

// Local minimal wrapper — ShowArchivedChip needs only Lingui.
i18n.load("en", {});
i18n.activate("en");

function renderChip(node: ReactNode) {
  return render(<I18nProvider i18n={i18n}>{node}</I18nProvider>);
}

describe("ShowArchivedChip", () => {
  it("off-state renders SHOW ARCHIVED and aria-pressed=false", () => {
    renderChip(<ShowArchivedChip active={false} count={3} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveTextContent(/SHOW ARCHIVED/i);
    expect(btn).toHaveTextContent("3");
  });

  it("on-state renders SHOWING ARCHIVED and aria-pressed=true", () => {
    renderChip(<ShowArchivedChip active={true} count={3} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveTextContent(/SHOWING ARCHIVED/i);
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    renderChip(
      <ShowArchivedChip active={false} count={0} onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("count renders in font-mono", () => {
    renderChip(
      <ShowArchivedChip active={false} count={42} onToggle={vi.fn()} />,
    );
    const btn = screen.getByRole("button");
    expect(btn.innerHTML).toContain("font-mono");
  });
});
