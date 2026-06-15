import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { RetroConfirmDialog } from "./RetroConfirmDialog";

function Host({
  onConfirm,
  onCancel,
}: {
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  return (
    <I18nProvider i18n={i18n}>
      <ModalStackProvider>
        <RetroConfirmDialog
          open
          title="DELETE ITEM"
          confirmLabel="Delete"
          onConfirm={onConfirm ?? (() => {})}
          onCancel={onCancel ?? (() => {})}
          onClose={onCancel ?? (() => {})}
        >
          This action cannot be undone.
        </RetroConfirmDialog>
      </ModalStackProvider>
    </I18nProvider>
  );
}

describe("RetroConfirmDialog", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a pink-titlebar confirm dialog by default", () => {
    render(<Host />);
    const dialog = screen.getByRole("dialog");
    // The titlebar header carries the pink variant class.
    const header = dialog.querySelector("header");
    expect(header?.className).toContain("bg-titlebar-pink");
  });

  it("defaults focus to the Cancel button (not Confirm)", () => {
    render(<Host />);
    const cancel = screen.getByRole("button", { name: /cancel/i });
    expect(document.activeElement).toBe(cancel);
  });

  it("calls onConfirm when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Host onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onCancel when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Host onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("uses the danger BevelButton variant for the confirm action", () => {
    render(<Host />);
    const confirm = screen.getByRole("button", { name: /delete/i });
    // danger variant => bg-danger-bg text-danger per BevelButton.
    expect(confirm.className).toContain("bg-danger-bg");
  });
});
