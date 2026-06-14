import { beforeAll, describe, expect, it, vi } from "vitest";
import { useEffect, useMemo, useRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import {
  ShortcutsProvider,
  useShortcuts,
  useShortcutsContext,
} from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import {
  RetroDialog,
  Popover,
  RetroTable,
  useTableSelection,
} from "@/components/retro";

// ============================================================================
// TUI-02 COMPOSITION PROOF (the test Phase 3 could not write).
//
// Phase 3 unit-tested the ModalStack PROVIDER (push/pop ordering in isolation).
// This file proves the COMPOSITION: three real, HETEROGENEOUS overlays — a
// RetroDialog (dialog), a second RetroDialog standing in for the drawer, and a
// Popover (menu) — stacked open simultaneously inside ONE ModalStackProvider.
// We assert ESC pops the TOPMOST overlay first at each step, that a bare-ESC
// logout listener NEVER fires while any overlay is open, and that the stack
// returns to balanced (empty) after all close.
//
// A separate describe block proves Success Criterion 5: a RetroTable +
// useTableSelection registers a `bulk-actions` group into the shortcuts SSOT
// when rows are selected (chips would surface in the Bottombar) and unregisters
// it when the selection clears.
// ============================================================================

// Simulates a route-level handler that would log out on a *bare* ESC. The
// capture-phase modal-stack arbiter must preventDefault before this bubble
// listener ever sees the key while any overlay is open (TUI-02 invariant).
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

/**
 * A host that opens three heterogeneous overlays in sequence (dialog → drawer →
 * menu). Each "open" button pushes the next overlay onto the stack; closing is
 * driven by ESC through the modal-stack arbiter, so the host only needs the
 * open triggers + the anchor for the Popover menu.
 */
function StackHost() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button type="button" onClick={() => setDialogOpen(true)}>
        Open dialog
      </button>
      <button type="button" onClick={() => setDrawerOpen(true)}>
        Open drawer
      </button>
      <button
        type="button"
        ref={menuAnchorRef}
        onClick={() => setMenuOpen(true)}
      >
        Open menu
      </button>

      <RetroDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Dialog title"
      >
        <p>Dialog body</p>
      </RetroDialog>

      {/* A second RetroDialog standing in for the drawer (a heterogeneous
          overlay type sharing the same stack arbiter). */}
      <RetroDialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Drawer title"
      >
        <p>Drawer body</p>
      </RetroDialog>

      <Popover
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={menuAnchorRef}
        role="menu"
      >
        <button type="button" role="menuitem">
          Menu item
        </button>
      </Popover>
    </>
  );
}

function renderStack(onLogout?: () => void) {
  return render(
    <I18nProvider i18n={i18n}>
      <ShortcutsProvider>
        <ModalStackProvider>
          {onLogout && <LogoutOnEscape onLogout={onLogout} />}
          <StackHost />
        </ModalStackProvider>
      </ShortcutsProvider>
    </I18nProvider>,
  );
}

describe("escStack — TUI-02 composition (dialog → drawer → menu)", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("pops the TOPMOST overlay first on each ESC (menu → drawer → dialog)", async () => {
    const user = userEvent.setup();
    renderStack();

    // Stack all three open.
    await user.click(screen.getByRole("button", { name: /open dialog/i }));
    await user.click(screen.getByRole("button", { name: /open drawer/i }));
    await user.click(screen.getByRole("button", { name: /open menu/i }));

    expect(screen.getByText("Dialog body")).toBeInTheDocument();
    expect(screen.getByText("Drawer body")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /menu item/i })).toBeInTheDocument();

    // First ESC → pops the MENU (topmost) only. Dialog + drawer remain.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menuitem", { name: /menu item/i })).not.toBeInTheDocument();
    expect(screen.getByText("Drawer body")).toBeInTheDocument();
    expect(screen.getByText("Dialog body")).toBeInTheDocument();

    // Second ESC → pops the DRAWER. Dialog remains.
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Drawer body")).not.toBeInTheDocument();
    expect(screen.getByText("Dialog body")).toBeInTheDocument();

    // Third ESC → pops the DIALOG. Stack now empty.
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Dialog body")).not.toBeInTheDocument();
  });

  it("NEVER logs out on bare ESC while any overlay is open", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    renderStack(onLogout);

    await user.click(screen.getByRole("button", { name: /open dialog/i }));
    await user.click(screen.getByRole("button", { name: /open drawer/i }));
    await user.click(screen.getByRole("button", { name: /open menu/i }));

    // Three ESCs to drain the whole stack — logout must stay silent throughout
    // because the capture-phase arbiter preventDefaults each one.
    await user.keyboard("{Escape}");
    expect(onLogout).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(onLogout).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("returns the stack to balanced — a later bare ESC is a safe no-op", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    renderStack(onLogout);

    await user.click(screen.getByRole("button", { name: /open dialog/i }));
    await user.click(screen.getByRole("button", { name: /open drawer/i }));
    await user.click(screen.getByRole("button", { name: /open menu/i }));

    // Drain all three.
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Dialog body")).not.toBeInTheDocument();
    expect(screen.queryByText("Drawer body")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();

    // Stack is empty now. A subsequent ESC reaches no overlay, does not crash,
    // and does not double-pop. With the stack empty, the bare-ESC route handler
    // would now be reachable (this is the ONLY time logout could fire) — proving
    // the arbiter only swallows ESC while overlays are open.
    await user.keyboard("{Escape}");
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

// ----------------------------------------------------------------------------
// Success Criterion 5 — bulk-action chip surfacing via the shortcuts SSOT.
// ----------------------------------------------------------------------------

interface Row {
  id: string;
  name: string;
}

const ROWS: Row[] = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Bravo" },
  { id: "c", name: "Charlie" },
];

/** Reads the merged shortcuts context and exposes the registered keys for the
 *  test to assert against — a stand-in for what the Bottombar renders as chips. */
function ShortcutsProbe() {
  const { shortcuts } = useShortcutsContext();
  return (
    <div data-testid="merged-shortcuts">
      {shortcuts.map((s) => s.label).join("|")}
    </div>
  );
}

/** Mirrors the DemoPage wiring: selecting rows registers a `bulk-actions` group
 *  (memoized bindings, Pitfall 3), clearing it unregisters. */
function BulkSelectionHost() {
  const selection = useTableSelection(ROWS);
  const selectedCount = selection.selected.size;
  const clearSelection = selection.clear;

  const bulkActions = useMemo(
    () =>
      selectedCount > 0
        ? [
            {
              key: "X",
              label: `Delete ${selectedCount} selected`,
              action: clearSelection,
              danger: true,
            },
          ]
        : [],
    [selectedCount, clearSelection],
  );
  useShortcuts("bulk-actions", bulkActions);

  return (
    <>
      <button type="button" onClick={clearSelection}>
        Clear selection
      </button>
      <RetroTable aria-multiselectable="true">
        <tbody>
          {ROWS.map((row) => (
            <tr
              key={row.id}
              aria-selected={selection.selected.has(row.id)}
              onClick={(e) => selection.onRowClick(row.id, e)}
            >
              <td>{row.name}</td>
            </tr>
          ))}
        </tbody>
      </RetroTable>
      <ShortcutsProbe />
    </>
  );
}

function renderBulk() {
  return render(
    <I18nProvider i18n={i18n}>
      <ShortcutsProvider>
        <ModalStackProvider>
          <BulkSelectionHost />
        </ModalStackProvider>
      </ShortcutsProvider>
    </I18nProvider>,
  );
}

describe("escStack — bulk-action chip registration (Success Criterion 5)", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("registers a bulk-actions group in the merged shortcuts when rows are selected", async () => {
    const user = userEvent.setup();
    renderBulk();

    const probe = screen.getByTestId("merged-shortcuts");
    // No selection → no bulk-actions group registered → no chips.
    expect(probe).toHaveTextContent("");

    // Select a row → the bulk-actions group registers into the SSOT.
    await user.click(screen.getByText("Alpha"));
    expect(probe).toHaveTextContent(/delete 1 selected/i);
  });

  it("unregisters the bulk-actions group when the selection clears", async () => {
    const user = userEvent.setup();
    renderBulk();

    const probe = screen.getByTestId("merged-shortcuts");
    await user.click(screen.getByText("Alpha"));
    expect(probe).toHaveTextContent(/delete 1 selected/i);

    // Clear the selection → the group unregisters → chips disappear.
    await user.click(screen.getByRole("button", { name: /clear selection/i }));
    expect(probe).toHaveTextContent("");
  });
});
