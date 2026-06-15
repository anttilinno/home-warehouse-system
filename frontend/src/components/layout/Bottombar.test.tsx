import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
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
import { Bottombar } from "./Bottombar";

// A helper route component that registers shortcuts into the SSOT on mount.
function RegisterShortcuts({ shortcuts }: { shortcuts: Shortcut[] }) {
  useShortcuts("test-route", shortcuts);
  return null;
}

function renderBottombar(
  routeShortcuts: Shortcut[],
  props: { onOpenHelp?: () => void; onBack?: () => void } = {},
) {
  const onOpenHelp = props.onOpenHelp ?? vi.fn();
  const onBack = props.onBack ?? vi.fn();
  const result = render(
    <I18nProvider i18n={i18n}>
      <ShortcutsProvider>
        <ModalStackProvider>
          <RegisterShortcuts shortcuts={routeShortcuts} />
          <Bottombar onOpenHelp={onOpenHelp} onBack={onBack} />
        </ModalStackProvider>
      </ShortcutsProvider>
    </I18nProvider>,
  );
  return { ...result, onOpenHelp, onBack };
}

describe("Bottombar", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-06-12T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders one chip per merged shortcut from the SSOT", () => {
    renderBottombar([
      { key: "N", label: "New", action: () => {} },
      { key: "E", label: "Edit", action: () => {} },
    ]);
    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer).getByRole("button", { name: /new/i }),
    ).toBeInTheDocument();
    expect(
      within(footer).getByRole("button", { name: /edit/i }),
    ).toBeInTheDocument();
  });

  it("renders a right-anchored F1 HELP chip and an ESC BACK chip", () => {
    renderBottombar([]);
    expect(screen.getByRole("button", { name: /help/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("renders the SESSION/LOCAL clock in the right cluster", () => {
    renderBottombar([]);
    expect(screen.getByText("SESSION")).toBeInTheDocument();
    expect(screen.getByText("LOCAL")).toBeInTheDocument();
  });

  it("invokes onOpenHelp when the F1 HELP chip is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenHelp } = renderBottombar([]);
    await user.click(screen.getByRole("button", { name: /help/i }));
    expect(onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it("invokes onBack when the ESC BACK chip is clicked", async () => {
    const user = userEvent.setup();
    const { onBack } = renderBottombar([]);
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("invokes a route shortcut's action when its chip is clicked", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    renderBottombar([{ key: "N", label: "New", action }]);
    await user.click(screen.getByRole("button", { name: /new/i }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("carries the `hidden md:flex` desktop-only contract on the root (D-06)", () => {
    renderBottombar([]);
    const footer = screen.getByRole("contentinfo");
    expect(footer.className).toContain("hidden");
    expect(footer.className).toContain("md:flex");
  });

  it("collapses overflow behind a ⋯ MORE chip while keeping F1/ESC + clocks present", () => {
    // Many route chips → exceed the overflow threshold.
    const many: Shortcut[] = Array.from({ length: 8 }, (_, i) => ({
      key: String.fromCharCode(65 + i),
      label: `Action ${i}`,
      action: () => {},
    }));
    renderBottombar(many);
    // The MORE affordance appears.
    expect(screen.getByRole("button", { name: /more/i })).toBeInTheDocument();
    // The right cluster stays intact.
    expect(screen.getByRole("button", { name: /help/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    expect(screen.getByText("SESSION")).toBeInTheDocument();
  });

  it("opens an overflow sheet listing the overflowed chips when MORE is clicked", async () => {
    const user = userEvent.setup();
    const overflowAction = vi.fn();
    const many: Shortcut[] = Array.from({ length: 8 }, (_, i) => ({
      key: String.fromCharCode(65 + i),
      label: `Action ${i}`,
      action: i === 7 ? overflowAction : () => {},
    }));
    renderBottombar(many);
    await user.click(screen.getByRole("button", { name: /more/i }));
    // The sheet (a dialog) is shown.
    const sheet = screen.getByRole("dialog");
    expect(sheet).toBeInTheDocument();
    // An overflowed action chip is reachable inside it; clicking fires + closes.
    await user.click(within(sheet).getByRole("button", { name: /action 7/i }));
    expect(overflowAction).toHaveBeenCalledTimes(1);
  });

  it("does NOT register a second document letter-keydown listener (Pitfall 2)", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    renderBottombar([{ key: "N", label: "New", action: () => {} }]);
    // The Bottombar itself must not own a keydown listener for letters.
    // (The ShortcutsProvider owns the one dispatcher; modal stack owns ESC.)
    const keydownCalls = addSpy.mock.calls.filter((c) => c[0] === "keydown");
    // Provider (1) + modal stack (1) = 2 at most; the Bottombar adds none.
    expect(keydownCalls.length).toBeLessThanOrEqual(2);
    addSpy.mockRestore();
  });
});
