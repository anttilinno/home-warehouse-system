import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { TopBar } from "./TopBar";
import type { User } from "@/lib/types";

const user: User = {
  id: "u1",
  email: "seeder@test.local",
  full_name: "Seed Er",
} as User;

// TopBar's logout confirm pushes onto the modal stack; wrap every render in the
// provider + i18n singleton so <Trans> and ESC ordering resolve.
function renderTopBar(ui: React.ReactElement) {
  return render(
    <I18nProvider i18n={i18n}>
      <ModalStackProvider>{ui}</ModalStackProvider>
    </I18nProvider>,
  );
}

describe("TopBar", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders a banner landmark with the brand mark", () => {
    renderTopBar(<TopBar user={user} onLogout={vi.fn()} />);
    const banner = screen.getByRole("banner");
    expect(banner).toBeInTheDocument();
    expect(within(banner).getByText(/WAREHOUSE/)).toBeInTheDocument();
  });

  it("renders the workspace pill as a disabled placeholder (Phase 5)", () => {
    renderTopBar(<TopBar user={user} onLogout={vi.fn()} />);
    const pill = screen.getByTestId("workspace-pill");
    expect(pill).toHaveAttribute("aria-disabled", "true");
    expect(pill).toHaveAttribute("title", "Switch workspace (Phase 5)");
  });

  it("shows ONLINE by default and OFFLINE when online={false}", () => {
    const { rerender } = renderTopBar(<TopBar user={user} onLogout={vi.fn()} />);
    expect(screen.getByText("ONLINE")).toBeInTheDocument();
    rerender(
      <I18nProvider i18n={i18n}>
        <ModalStackProvider>
          <TopBar user={user} online={false} onLogout={vi.fn()} />
        </ModalStackProvider>
      </I18nProvider>,
    );
    expect(screen.getByText("OFFLINE")).toBeInTheDocument();
  });

  it("renders disabled reserved bell + SSE slots", () => {
    renderTopBar(<TopBar user={user} onLogout={vi.fn()} />);
    const bell = screen.getByTestId("bell-slot");
    expect(bell).toHaveAttribute("aria-disabled", "true");
    expect(bell).toHaveAttribute("title", "Coming soon");
    expect(screen.getByTestId("sse-slot")).toBeInTheDocument();
  });

  it("opens the user menu with aria-haspopup/expanded and a Log out item", async () => {
    const u = userEvent.setup();
    renderTopBar(<TopBar user={user} onLogout={vi.fn()} />);
    const trigger = screen.getByTestId("user-pill");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await u.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: /log out/i })).toBeInTheDocument();
  });

  it("clicking Log out opens a confirm dialog; confirming calls onLogout", async () => {
    const u = userEvent.setup();
    const onLogout = vi.fn();
    renderTopBar(<TopBar user={user} onLogout={onLogout} />);
    await u.click(screen.getByTestId("user-pill"));
    await u.click(screen.getByRole("menuitem", { name: /log out/i }));
    // Confirm dialog with LOG OUT / STAY.
    expect(screen.getByText(/end this session/i)).toBeInTheDocument();
    expect(onLogout).not.toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: /^log out$/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("ESC closes the confirm dialog but does NOT call onLogout (BAR-05)", async () => {
    const u = userEvent.setup();
    const onLogout = vi.fn();
    renderTopBar(<TopBar user={user} onLogout={onLogout} />);
    await u.click(screen.getByTestId("user-pill"));
    await u.click(screen.getByRole("menuitem", { name: /log out/i }));
    expect(screen.getByText(/end this session/i)).toBeInTheDocument();
    await u.keyboard("{Escape}");
    expect(screen.queryByText(/end this session/i)).not.toBeInTheDocument();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("STAY closes the confirm without logging out", async () => {
    const u = userEvent.setup();
    const onLogout = vi.fn();
    renderTopBar(<TopBar user={user} onLogout={onLogout} />);
    await u.click(screen.getByTestId("user-pill"));
    await u.click(screen.getByRole("menuitem", { name: /log out/i }));
    await u.click(screen.getByRole("button", { name: /^stay$/i }));
    expect(screen.queryByText(/end this session/i)).not.toBeInTheDocument();
    expect(onLogout).not.toHaveBeenCalled();
  });
});
