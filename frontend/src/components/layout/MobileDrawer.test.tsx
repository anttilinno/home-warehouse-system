import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { MobileDrawer } from "./MobileDrawer";

function renderDrawer(
  props: {
    open?: boolean;
    onClose?: () => void;
  } = {},
) {
  const open = props.open ?? true;
  const onClose = props.onClose ?? vi.fn();
  const result = render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>
        <ModalStackProvider>
          <MobileDrawer open={open} onClose={onClose} />
        </ModalStackProvider>
      </MemoryRouter>
    </I18nProvider>,
  );
  return { ...result, onClose };
}

describe("MobileDrawer", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a modal dialog with the Navigator when open", () => {
    renderDrawer({ open: true });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // The Navigator nav landmark is inside the drawer.
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    renderDrawer({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on scrim click", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer({ open: true });
    await user.click(screen.getByTestId("drawer-scrim"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on ESC via the modal stack", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer({ open: true });
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when a nav link is selected", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer({ open: true });
    // The Dashboard NavLink is a real link; selecting it closes the drawer.
    await user.click(screen.getByRole("link", { name: /dashboard/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the drawer on open (focus trap entry)", () => {
    renderDrawer({ open: true });
    const dialog = screen.getByRole("dialog");
    // Focus is moved into the drawer surface (or a child) on open.
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
