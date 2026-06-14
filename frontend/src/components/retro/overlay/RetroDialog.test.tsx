import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { RetroDialog } from "./RetroDialog";
import { useEffect, useState } from "react";

/** A bare-ESC logout listener that MUST stay silent while an overlay is open. */
function LogoutOnEscape({ onLogout }: { onLogout: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onLogout();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onLogout]);
  return null;
}

function Host({
  initialOpen = false,
  onClose,
  onLogout,
}: {
  initialOpen?: boolean;
  onClose?: () => void;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const close = () => {
    setOpen(false);
    onClose?.();
  };
  return (
    <I18nProvider i18n={i18n}>
      <ModalStackProvider>
        {onLogout && <LogoutOnEscape onLogout={onLogout} />}
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <RetroDialog open={open} onClose={close} title="DIALOG TITLE">
          <button type="button">First</button>
          <button type="button">Last</button>
        </RetroDialog>
      </ModalStackProvider>
    </I18nProvider>
  );
}

describe("RetroDialog", () => {
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

  it("renders nothing when closed", () => {
    render(<Host />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders a labelled modal dialog when open", () => {
    render(<Host initialOpen />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(within(dialog).getByText(/dialog title/i).id).toBe(labelledBy);
  });

  it("moves focus into the dialog on open and restores to the invoker on close", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const opener = screen.getByRole("button", { name: /open/i });
    opener.focus();
    expect(document.activeElement).toBe(opener);
    await user.click(opener);
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  it("traps focus: Tab wraps last→first and Shift+Tab wraps first→last", async () => {
    const user = userEvent.setup();
    render(<Host initialOpen />);
    const dialog = screen.getByRole("dialog");
    const focusables = within(dialog).getAllByRole("button");
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    last.focus();
    await user.keyboard("{Tab}");
    expect(document.activeElement).toBe(first);
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(last);
  });

  it("closes on ESC via the modal stack and does NOT log out", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(<Host initialOpen onLogout={onLogout} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("closes when the titlebar close box is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Host initialOpen onClose={onClose} />);
    const closeBox = screen.getByRole("button", { name: /close/i });
    await user.click(closeBox);
    expect(onClose).toHaveBeenCalled();
  });
});
