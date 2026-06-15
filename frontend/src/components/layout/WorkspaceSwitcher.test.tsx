import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import type { Workspace } from "@/lib/types";
import type { WorkspaceContextValue } from "@/features/workspace/WorkspaceProvider";

// Mock the D-12 hook so the switcher's state branches (loading/single/zero/
// multi) and setWorkspace dispatch can be driven directly — the provider's own
// behavior is covered in WorkspaceProvider.test.tsx.
const useWorkspaceMock = vi.fn<() => WorkspaceContextValue>();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

// Spy the mint toast so the "Switched to {name}." copy can be asserted.
const toastSuccess = vi.fn();
vi.mock("@/components/retro", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/retro")>();
  return {
    ...actual,
    retroToast: Object.assign((...a: unknown[]) => a, {
      ...actual.retroToast,
      success: (...args: unknown[]) => toastSuccess(...args),
    }),
  };
});

import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const WS: Workspace[] = [
  {
    id: "ws-A",
    name: "Alpha",
    slug: "alpha",
    description: null,
    role: "owner",
    is_personal: true,
  },
  {
    id: "ws-B",
    name: "Beta",
    slug: "beta",
    description: null,
    role: "member",
    is_personal: false,
  },
];

function setContext(partial: Partial<WorkspaceContextValue>) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId: "ws-A",
    setWorkspace: vi.fn(),
    workspaces: WS,
    isLoading: false,
    ...partial,
  });
}

function renderSwitcher() {
  return render(
    <I18nProvider i18n={i18n}>
      <ModalStackProvider>
        <WorkspaceSwitcher />
      </ModalStackProvider>
    </I18nProvider>,
  );
}

describe("WorkspaceSwitcher", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the current workspace name in the trigger with listbox aria", () => {
    setContext({ currentWorkspaceId: "ws-A", workspaces: WS });
    renderSwitcher();
    const pill = screen.getByTestId("workspace-pill");
    expect(pill).toHaveAttribute("aria-haspopup", "listbox");
    expect(pill).toHaveAttribute("aria-expanded", "false");
    expect(pill).toHaveTextContent("Alpha");
  });

  it("opens a listbox of options; the current one is aria-selected with a check", async () => {
    setContext({ currentWorkspaceId: "ws-A", workspaces: WS });
    const u = userEvent.setup();
    renderSwitcher();
    await u.click(screen.getByTestId("workspace-pill"));

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    const current = screen.getByRole("option", { name: /alpha/i });
    expect(current).toHaveAttribute("aria-selected", "true");
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).toHaveTextContent("✓");
  });

  it("clicking a non-current row switches, closes, and fires a mint toast", async () => {
    const setWorkspace = vi.fn();
    setContext({ currentWorkspaceId: "ws-A", workspaces: WS, setWorkspace });
    const u = userEvent.setup();
    renderSwitcher();
    await u.click(screen.getByTestId("workspace-pill"));
    await u.click(screen.getByRole("option", { name: /beta/i }));

    expect(setWorkspace).toHaveBeenCalledWith("ws-B");
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(String(toastSuccess.mock.calls[0][0])).toMatch(/Switched to Beta/);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clicking the current row closes without switching or toasting", async () => {
    const setWorkspace = vi.fn();
    setContext({ currentWorkspaceId: "ws-A", workspaces: WS, setWorkspace });
    const u = userEvent.setup();
    renderSwitcher();
    await u.click(screen.getByTestId("workspace-pill"));
    await u.click(screen.getByRole("option", { name: /alpha/i }));

    expect(setWorkspace).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders a non-expanding aria-disabled pill when exactly one workspace exists", () => {
    setContext({ currentWorkspaceId: "ws-A", workspaces: [WS[0]] });
    renderSwitcher();
    const pill = screen.getByTestId("workspace-pill");
    expect(pill).toHaveAttribute("aria-disabled", "true");
    expect(pill).not.toHaveAttribute("aria-haspopup");
    expect(pill).toHaveTextContent("Alpha");
  });

  it("renders an aria-busy skeleton while workspaces are loading", () => {
    setContext({
      currentWorkspaceId: null,
      workspaces: undefined,
      isLoading: true,
    });
    renderSwitcher();
    const pill = screen.getByTestId("workspace-pill");
    expect(pill).toHaveAttribute("aria-busy", "true");
  });

  it("shows the empty row when there are zero workspaces", async () => {
    // Two-workspace-shaped guard is bypassed: zero list, but force-open by
    // rendering with currentWorkspaceId null and an empty array.
    setContext({ currentWorkspaceId: null, workspaces: [] });
    const u = userEvent.setup();
    renderSwitcher();
    await u.click(screen.getByTestId("workspace-pill"));
    expect(
      screen.getByText(/no workspaces\. contact an owner\./i),
    ).toBeInTheDocument();
  });

  it("ESC closes the popover and does NOT log out (BAR-05)", async () => {
    const onLogout = vi.fn();
    setContext({ currentWorkspaceId: "ws-A", workspaces: WS });
    const u = userEvent.setup();
    render(
      <I18nProvider i18n={i18n}>
        <ModalStackProvider>
          <LogoutOnEscape onLogout={onLogout} />
          <WorkspaceSwitcher />
        </ModalStackProvider>
      </I18nProvider>,
    );
    await u.click(screen.getByTestId("workspace-pill"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await u.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onLogout).not.toHaveBeenCalled();
  });
});

// A bare document ESC listener that fires onLogout only when the keydown was not
// already handled (defaultPrevented) by the modal-stack arbiter — proves ESC is
// swallowed by the popover before reaching a logout path.
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
