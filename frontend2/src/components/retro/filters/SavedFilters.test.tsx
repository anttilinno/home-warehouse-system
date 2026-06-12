import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { SavedFilters } from "./SavedFilters";
import type { SavedFilter } from "./useSavedFilters";

function wrap(ui: React.ReactNode) {
  return (
    <I18nProvider i18n={i18n}>
      <ModalStackProvider>{ui}</ModalStackProvider>
    </I18nProvider>
  );
}

const PRESETS: SavedFilter[] = [
  { id: "1", name: "Low stock", filters: { qtyLt: 5 }, createdAt: "2026-01-01" },
  { id: "2", name: "Tools", filters: { category: "tools" }, createdAt: "2026-01-02" },
];

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("SavedFilters", () => {
  it("renders preset chips as <button>s; the active preset has aria-pressed='true'", () => {
    render(
      wrap(
        <SavedFilters
          savedFilters={PRESETS}
          activeId="2"
          onApply={vi.fn()}
          onDelete={vi.fn()}
          onSaveCurrent={vi.fn()}
        />,
      ),
    );

    const lowStock = screen.getByRole("button", { name: "Low stock" });
    expect(lowStock.tagName).toBe("BUTTON");
    expect(lowStock).toHaveAttribute("aria-pressed", "false");

    const tools = screen.getByRole("button", { name: "Tools" });
    expect(tools).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking a preset chip calls onApply with its id", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      wrap(
        <SavedFilters
          savedFilters={PRESETS}
          onApply={onApply}
          onDelete={vi.fn()}
          onSaveCurrent={vi.fn()}
        />,
      ),
    );

    await user.click(screen.getByRole("button", { name: "Low stock" }));
    expect(onApply).toHaveBeenCalledWith("1");
  });

  it("▾ PRESETS opens a menu listing presets + a SAVE CURRENT… item", async () => {
    const user = userEvent.setup();
    render(
      wrap(
        <SavedFilters
          savedFilters={PRESETS}
          onApply={vi.fn()}
          onDelete={vi.fn()}
          onSaveCurrent={vi.fn()}
        />,
      ),
    );

    await user.click(screen.getByRole("button", { name: /presets/i }));
    expect(await screen.findByText("SAVE CURRENT…")).toBeInTheDocument();
    // Presets are listed inside the menu (menuitems carry their names).
    expect(screen.getAllByText("Tools").length).toBeGreaterThan(0);
  });

  it("the empty menu shows 'No saved filters yet.'", async () => {
    const user = userEvent.setup();
    render(
      wrap(
        <SavedFilters
          savedFilters={[]}
          onApply={vi.fn()}
          onDelete={vi.fn()}
          onSaveCurrent={vi.fn()}
        />,
      ),
    );

    await user.click(screen.getByRole("button", { name: /presets/i }));
    expect(await screen.findByText("No saved filters yet.")).toBeInTheDocument();
  });

  it("per-preset delete opens a RetroConfirmDialog before removing", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      wrap(
        <SavedFilters
          savedFilters={PRESETS}
          onApply={vi.fn()}
          onDelete={onDelete}
          onSaveCurrent={vi.fn()}
        />,
      ),
    );

    await user.click(screen.getByRole("button", { name: /presets/i }));
    // Each preset row carries a delete control.
    const deleteButtons = await screen.findAllByRole("button", {
      name: /delete preset/i,
    });
    await user.click(deleteButtons[0]);

    // A confirm dialog appears; onDelete is NOT called until confirmed.
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "DELETE" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
