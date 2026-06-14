import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { RetroTabs, type RetroTab } from "./RetroTabs";

const tabs: RetroTab[] = [
  { id: "details", label: "Details", content: <p>details panel</p> },
  { id: "history", label: "History", content: <p>history panel</p> },
  { id: "audit", label: "Audit", content: <p>audit panel</p>, disabled: true },
  { id: "notes", label: "Notes", content: <p>notes panel</p> },
];

// Controlled wrapper so clicks/arrows actually swap the active tab in tests.
function ControlledTabs({ initial = "details" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <RetroTabs tabs={tabs} value={value} onChange={setValue} />;
}

describe("RetroTabs", () => {
  it("renders a tablist with tabs and the active tabpanel wired via ARIA", () => {
    render(<ControlledTabs />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();

    const detailsTab = screen.getByRole("tab", { name: "Details" });
    expect(detailsTab).toHaveAttribute("aria-selected", "true");

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("details panel");
    // panel labelled by the active tab; tab controls the panel.
    expect(panel).toHaveAttribute("aria-labelledby", detailsTab.id);
    expect(detailsTab).toHaveAttribute("aria-controls", panel.id);
  });

  it("clicking a tab activates it (aria-selected flips, panel content swaps)", async () => {
    const user = userEvent.setup();
    render(<ControlledTabs />);

    await user.click(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("history panel");
  });

  it("only the active tab has tabIndex 0 (roving tabindex)", () => {
    render(<ControlledTabs />);
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("ArrowRight/ArrowLeft move focus and activation across tabs, skipping disabled", async () => {
    const user = userEvent.setup();
    render(<ControlledTabs />);

    const details = screen.getByRole("tab", { name: "Details" });
    details.focus();

    await user.keyboard("{ArrowRight}"); // → History
    expect(screen.getByRole("tab", { name: "History" })).toHaveFocus();

    await user.keyboard("{ArrowRight}"); // skip disabled Audit → Notes
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}"); // ← skip disabled Audit → History
    expect(screen.getByRole("tab", { name: "History" })).toHaveFocus();
  });

  it("disabled tab is not activatable by click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RetroTabs tabs={tabs} value="details" onChange={onChange} />);

    await user.click(screen.getByRole("tab", { name: "Audit" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
