import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { notificationHandlers } from "@/test/msw/notificationHandlers";
import { ModalStackProvider } from "@/components/modal";
import type { Workspace } from "@/lib/types";
import type { WorkspaceContextValue } from "@/features/workspace/WorkspaceProvider";

// The TopBar now renders the live WorkspaceSwitcher (AUTH-06), which reads the
// D-12 useWorkspace() context. Mock it so TopBar's own chrome tests stay focused
// on the banner/user-menu/logout contract — the switcher behavior is covered in
// WorkspaceSwitcher.test.tsx. A two-workspace context = an interactive pill.
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
const wsContext: WorkspaceContextValue = {
  currentWorkspaceId: "ws-A",
  setWorkspace: vi.fn(),
  workspaces: WS,
  isLoading: false,
};
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => wsContext,
}));

// TopBar reads useSSEStatus() for the sse-slot RetroStatusDot (and as the
// default for its `online` dot). Mock the feature so the banner renders without
// a live SSEProvider; `sseStatus` is mutable per-test to flip connected.
let sseStatus = { connected: true, lastEventAt: null as Date | null };
vi.mock("@/features/sse", () => ({
  useSSEStatus: () => sseStatus,
}));

import { TopBar } from "./TopBar";

// TopBar's logout confirm pushes onto the modal stack; wrap every render in the
// provider + i18n singleton so <Trans> and ESC ordering resolve. Phase 13: the
// live NotificationsBell calls useQuery (unread-count poll), so a
// QueryClientProvider is also required.
function renderTopBar(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>{ui}</ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe("TopBar", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  beforeEach(() => {
    // Default each test to a connected stream; SSE-slot tests flip this.
    sseStatus = { connected: true, lastEventAt: null };
    // The live NotificationsBell polls /api/notifications/unread/count on mount;
    // register the user-scoped handlers so onUnhandledRequest:"error" stays quiet.
    server.use(...notificationHandlers);
  });

  it("renders a banner landmark with the brand mark", () => {
    renderTopBar(<TopBar />);
    const banner = screen.getByRole("banner");
    expect(banner).toBeInTheDocument();
    expect(within(banner).getByText(/WAREHOUSE/)).toBeInTheDocument();
  });

  it("renders the workspace pill as the live AUTH-06 switcher (no longer disabled)", () => {
    renderTopBar(<TopBar />);
    const pill = screen.getByTestId("workspace-pill");
    // The Phase 3 static disabled placeholder is gone — a 2-workspace context
    // renders an interactive listbox trigger showing the current workspace.
    expect(pill).not.toHaveAttribute("aria-disabled");
    expect(pill).toHaveAttribute("aria-haspopup", "listbox");
    expect(pill).toHaveTextContent("Alpha");
  });

  it("shows ONLINE by default and OFFLINE when online={false}", () => {
    const { rerender } = renderTopBar(<TopBar />);
    expect(screen.getByText("ONLINE")).toBeInTheDocument();
    rerender(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={new QueryClient()}>
          <ModalStackProvider>
            <TopBar online={false} />
          </ModalStackProvider>
        </QueryClientProvider>
      </I18nProvider>,
    );
    expect(screen.getByText("OFFLINE")).toBeInTheDocument();
  });

  it("defaults the ONLINE dot from useSSEStatus().connected when no online prop", () => {
    sseStatus = { connected: false, lastEventAt: null };
    renderTopBar(<TopBar />);
    // No explicit online prop → falls back to the live SSE status (disconnected).
    expect(screen.getByText("OFFLINE")).toBeInTheDocument();
  });

  it("renders the live notifications bell at the stable bell-slot testid (Phase 13)", () => {
    renderTopBar(<TopBar />);
    const bell = screen.getByTestId("bell-slot");
    // The reserved disabled placeholder is gone — bell-slot is now an
    // interactive button (NotificationsBell) opening the notifications dropdown.
    expect(bell.tagName).toBe("BUTTON");
    expect(bell).not.toHaveAttribute("aria-disabled");
    expect(bell).toHaveAttribute("aria-haspopup", "menu");
    expect(bell).toHaveAttribute("aria-label", "Notifications");
  });

  it("binds the sse-slot RetroStatusDot to live state — 'live' when connected", () => {
    sseStatus = { connected: true, lastEventAt: null };
    renderTopBar(<TopBar />);
    const slot = screen.getByTestId("sse-slot");
    // The static '● live' placeholder is gone — the live RetroStatusDot renders
    // its `live` word + mint dot when the stream is connected (no more raw text).
    expect(within(slot).getByText("live")).toBeInTheDocument();
    expect(within(slot).getByTestId("status-dot")).toHaveClass("bg-titlebar-mint");
    expect(within(slot).queryByText("● live")).not.toBeInTheDocument();
  });

  it("renders the sse-slot RetroStatusDot in 'idle' state when disconnected", () => {
    sseStatus = { connected: false, lastEventAt: null };
    renderTopBar(<TopBar />);
    const slot = screen.getByTestId("sse-slot");
    expect(within(slot).getByText("offline")).toBeInTheDocument();
    expect(within(slot).getByTestId("status-dot")).toHaveClass("bg-fg-faint");
  });

  it("no longer renders an account pill — the user menu moved to the Sidebar", () => {
    renderTopBar(<TopBar />);
    expect(screen.queryByTestId("user-pill")).not.toBeInTheDocument();
  });
});
