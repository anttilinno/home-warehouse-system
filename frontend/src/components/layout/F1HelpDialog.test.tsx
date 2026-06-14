import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import {
  ShortcutsProvider,
  useShortcuts,
  type Shortcut,
} from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { F1HelpDialog } from "./F1HelpDialog";

function RegisterShortcuts({ shortcuts }: { shortcuts: Shortcut[] }) {
  useShortcuts("test-route", shortcuts);
  return null;
}

/** A stateful host so F1 keydown toggling is observable end-to-end. */
function Host({
  routeShortcuts,
  onLogout,
}: {
  routeShortcuts: Shortcut[];
  onLogout?: () => void;
}) {
  return (
    <I18nProvider i18n={i18n}>
      <ShortcutsProvider>
        <ModalStackProvider>
          {/* A bare-ESC logout listener that MUST stay silent while open. */}
          {onLogout && <LogoutOnEscape onLogout={onLogout} />}
          <RegisterShortcuts shortcuts={routeShortcuts} />
          <Controlled />
        </ModalStackProvider>
      </ShortcutsProvider>
    </I18nProvider>
  );
}

import { useState, useEffect } from "react";

function Controlled() {
  const [open, setOpen] = useState(false);
  return <F1HelpDialog open={open} onClose={() => setOpen(false)} onToggle={() => setOpen((o) => !o)} />;
}

// Simulates a route-level handler that would log out on a *bare* ESC — it must
// never fire while an overlay is on the modal stack.
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

describe("F1HelpDialog", () => {
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
    render(<Host routeShortcuts={[]} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the KEYBOARD SHORTCUTS dialog on F1 keydown", async () => {
    const user = userEvent.setup();
    render(<Host routeShortcuts={[]} />);
    await user.keyboard("{F1}");
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/keyboard shortcuts/i)).toBeInTheDocument();
  });

  it("lists merged route shortcuts grouped by scope", async () => {
    const user = userEvent.setup();
    render(
      <Host
        routeShortcuts={[{ key: "N", label: "New item", action: () => {} }]}
      />,
    );
    await user.keyboard("{F1}");
    const dialog = screen.getByRole("dialog");
    // Global group always lists F1 + ESC synthetics.
    expect(within(dialog).getByText(/global/i)).toBeInTheDocument();
    // The route shortcut shows up as a chip + description.
    expect(within(dialog).getByRole("button", { name: /new item/i })).toBeInTheDocument();
  });

  it("closes on ESC via the modal stack and does NOT log out", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(<Host routeShortcuts={[]} onLogout={onLogout} />);
    await user.keyboard("{F1}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("renders the NO SHORTCUTS HERE empty state for an empty route set", async () => {
    const user = userEvent.setup();
    render(<Host routeShortcuts={[]} />);
    await user.keyboard("{F1}");
    expect(screen.getByText(/no shortcuts here/i)).toBeInTheDocument();
  });

  it("traps focus inside the dialog when open", async () => {
    const user = userEvent.setup();
    render(
      <Host
        routeShortcuts={[{ key: "N", label: "New item", action: () => {} }]}
      />,
    );
    await user.keyboard("{F1}");
    const dialog = screen.getByRole("dialog");
    // Focus is moved into the dialog on open.
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
