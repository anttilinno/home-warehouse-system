import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { BulkActionBar } from "./BulkActionBar";
import { BevelButton } from "@/components/retro";

function wrap(ui: React.ReactNode) {
  return (
    <I18nProvider i18n={i18n}>
      <ModalStackProvider>{ui}</ModalStackProvider>
    </I18nProvider>
  );
}

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("BulkActionBar", () => {
  it("renders role=toolbar aria-label='Bulk actions' with a {n} SELECTED count and ✕ CLEAR", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      wrap(
        <BulkActionBar selectedCount={3} onClear={onClear}>
          <BevelButton>EXPORT</BevelButton>
        </BulkActionBar>,
      ),
    );

    const toolbar = screen.getByRole("toolbar", { name: "Bulk actions" });
    expect(toolbar).toBeInTheDocument();
    expect(screen.getByText(/3 SELECTED/)).toBeInTheDocument();
    expect(screen.getByText("EXPORT")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it("the count region is announced via aria-live='polite'", () => {
    render(
      wrap(
        <BulkActionBar selectedCount={2} onClear={vi.fn()}>
          <BevelButton>EXPORT</BevelButton>
        </BulkActionBar>,
      ),
    );

    const count = screen.getByText(/2 SELECTED/);
    // The live region wraps the count.
    const live = count.closest("[aria-live='polite']");
    expect(live).not.toBeNull();
  });

  it("a destructive action routes through RetroConfirmDialog (opens a confirm, not an immediate call)", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      wrap(
        <BulkActionBar
          selectedCount={4}
          onClear={vi.fn()}
          destructiveAction={{
            label: "DELETE",
            confirmTitle: "DELETE ITEMS",
            confirmBody: "Delete 4 items? This can't be undone.",
            onConfirm,
          }}
        />,
      ),
    );

    await user.click(screen.getByRole("button", { name: "DELETE" }));
    // Confirm dialog appears; the destructive handler has NOT fired yet.
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    // Confirm: there are now two "DELETE" buttons (the bar + the dialog confirm);
    // the dialog confirm is the last one.
    const deletes = screen.getAllByRole("button", { name: "DELETE" });
    await user.click(deletes[deletes.length - 1]);
    expect(onConfirm).toHaveBeenCalled();
  });
});
