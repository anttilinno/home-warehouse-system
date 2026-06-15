import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import {
  ShortcutsProvider,
  useShortcuts,
  type Shortcut,
} from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { Fab } from "./Fab";

function RegisterShortcuts({ shortcuts }: { shortcuts: Shortcut[] }) {
  useShortcuts("test-route", shortcuts);
  return null;
}

function renderFab(routeShortcuts: Shortcut[]) {
  return render(
    <MemoryRouter>
      <I18nProvider i18n={i18n}>
        <ShortcutsProvider>
          <ModalStackProvider>
            <RegisterShortcuts shortcuts={routeShortcuts} />
            <Fab />
          </ModalStackProvider>
        </ShortcutsProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe("Fab", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders a trigger with aria-haspopup=menu and is mobile-only (md:hidden)", () => {
    renderFab([]);
    const trigger = screen.getByRole("button", { name: /quick actions/i });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // The whole FAB surface (root container) is mobile-only — D-05.
    const root = trigger.closest(".md\\:hidden");
    expect(root).not.toBeNull();
  });

  it("opens a menu of items derived from the SSOT shortcuts", async () => {
    const user = userEvent.setup();
    renderFab([
      { key: "N", label: "New item", action: () => {} },
      { key: "S", label: "Scan", action: () => {} },
    ]);
    await user.click(screen.getByRole("button", { name: /quick actions/i }));
    const menu = screen.getByRole("menu");
    expect(
      within(menu).getByRole("menuitem", { name: /new item/i }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: /scan/i }),
    ).toBeInTheDocument();
  });

  it("invokes a shortcut's action and closes the menu when an item is selected", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    renderFab([{ key: "N", label: "New item", action }]);
    await user.click(screen.getByRole("button", { name: /quick actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /new item/i }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("exposes a single default '+ ADD ITEM' action when no shortcuts are registered", async () => {
    const user = userEvent.setup();
    renderFab([]);
    await user.click(screen.getByRole("button", { name: /quick actions/i }));
    const menu = screen.getByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/add item/i);
  });

  it("closes the menu on ESC without logging out (modal stack)", async () => {
    const user = userEvent.setup();
    renderFab([{ key: "N", label: "New item", action: () => {} }]);
    await user.click(screen.getByRole("button", { name: /quick actions/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("toggles closed when the trigger is tapped again", async () => {
    const user = userEvent.setup();
    renderFab([{ key: "N", label: "New item", action: () => {} }]);
    const trigger = screen.getByRole("button", { name: /quick actions/i });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("imports no motion / framer animation library (CSS transitions only)", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/layout/Fab.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/from\s+["'](framer-)?motion["']/);
  });
});
