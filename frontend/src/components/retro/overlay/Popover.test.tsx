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
import { Popover } from "./Popover";
import { useEffect, useRef, useState } from "react";

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
  onLogout,
}: {
  initialOpen?: boolean;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <I18nProvider i18n={i18n}>
      <ModalStackProvider>
        {onLogout && <LogoutOnEscape onLogout={onLogout} />}
        <button ref={anchorRef} type="button" onClick={() => setOpen(true)}>
          Trigger
        </button>
        <Popover
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={anchorRef}
          role="menu"
        >
          <button type="button" role="menuitem">
            Item One
          </button>
        </Popover>
      </ModalStackProvider>
    </I18nProvider>
  );
}

describe("Popover", () => {
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

  it("clamps the panel to the viewport's right edge", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // Trigger hugs the right edge of a 1000px viewport; the panel is 200px.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 950,
      right: 990,
      top: 100,
      bottom: 130,
      width: 40,
      height: 30,
      x: 950,
      y: 100,
      toJSON: () => ({}),
    });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(200);
    vi.stubGlobal("innerWidth", 1000);
    render(<Host />);
    await user.click(screen.getByRole("button", { name: "Trigger" }));
    expect(screen.getByRole("menu").style.left).toBe("792px");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders nothing when closed", () => {
    render(<Host />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders a floating panel with the requested role when open", () => {
    render(<Host initialOpen />);
    const panel = screen.getByRole("menu");
    expect(panel).toBeInTheDocument();
    expect(panel.className).toContain("border-border-ink");
  });

  it("moves focus into the panel on open and restores to the anchor on close", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const trigger = screen.getByRole("button", { name: /trigger/i });
    await user.click(trigger);
    const panel = screen.getByRole("menu");
    expect(panel.contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on ESC via the modal stack and does NOT log out", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(<Host initialOpen onLogout={onLogout} />);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("closes on tap-outside (backdrop click)", async () => {
    const user = userEvent.setup();
    render(<Host initialOpen />);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    const backdrop = screen.getByTestId("popover-backdrop");
    await user.click(backdrop);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
