import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { ALL_NOTIFS, NOTIF_UNREAD } from "@/test/msw/notificationHandlers";
import type { NotificationDTO } from "@/lib/api/notifications";
import { NotificationsBell } from "./NotificationsBell";

// USER-scoped — NO useWorkspace mock needed (notifications take no wsId).

function listEnvelope(items: NotificationDTO[]) {
  return { items, total: items.length, page: 1, total_pages: 1 };
}

interface Fixtures {
  count?: number;
  list?: NotificationDTO[];
  readSpy?: (id: string) => void;
  allReadSpy?: () => void;
}

function installHandlers(f: Fixtures) {
  server.use(
    http.get("/api/notifications/unread/count", () =>
      HttpResponse.json({ count: f.count ?? 0 }),
    ),
    http.get("/api/notifications", () =>
      HttpResponse.json(listEnvelope(f.list ?? [])),
    ),
    http.post("/api/notifications/read-all", () => {
      f.allReadSpy?.();
      return new HttpResponse(null, { status: 204 });
    }),
    http.post("/api/notifications/:id/read", ({ params }) => {
      f.readSpy?.(String(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  );
}

function renderBell() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>{children}</ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
  return render(<NotificationsBell />, { wrapper });
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("NotificationsBell", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders a button with the stable data-testid='bell-slot' and aria-haspopup", () => {
    installHandlers({ count: 0, list: [] });
    renderBell();
    const bell = screen.getByTestId("bell-slot");
    expect(bell).toHaveAttribute("aria-haspopup", "menu");
    expect(bell).toHaveAttribute("aria-label", "Notifications");
  });

  it("shows the unread-count badge when count > 0", async () => {
    installHandlers({ count: 3, list: ALL_NOTIFS });
    renderBell();
    await waitFor(() => {
      expect(screen.getByTestId("bell-slot")).toHaveTextContent("3");
    });
  });

  it("renders NO badge when count === 0", async () => {
    installHandlers({ count: 0, list: [] });
    renderBell();
    // Let the count query settle, then assert the bell carries no numeric badge.
    await waitFor(() => {
      expect(screen.getByTestId("bell-slot")).toBeInTheDocument();
    });
    expect(screen.getByTestId("bell-slot").textContent).not.toMatch(/\d/);
  });

  it("opens the dropdown listing notifications on click", async () => {
    installHandlers({ count: 1, list: ALL_NOTIFS });
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByTestId("bell-slot"));
    expect(await screen.findByText(NOTIF_UNREAD.title)).toBeInTheDocument();
  });

  it("shows the RetroEmptyState when the list is empty", async () => {
    installHandlers({ count: 0, list: [] });
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByTestId("bell-slot"));
    expect(await screen.findByText("No notifications")).toBeInTheDocument();
  });

  it("clicking a row's mark-read POSTs /{id}/read", async () => {
    const readSpy = vi.fn();
    installHandlers({ count: 1, list: ALL_NOTIFS, readSpy });
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByTestId("bell-slot"));
    await screen.findByText(NOTIF_UNREAD.title);
    // Only the unread row carries a "Mark read" affordance.
    await user.click(screen.getByRole("button", { name: "Mark read" }));
    await waitFor(() => expect(readSpy).toHaveBeenCalledWith(NOTIF_UNREAD.id));
  });

  it("clicking 'Mark all read' POSTs /read-all", async () => {
    const allReadSpy = vi.fn();
    installHandlers({ count: 1, list: ALL_NOTIFS, allReadSpy });
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByTestId("bell-slot"));
    await screen.findByText(NOTIF_UNREAD.title);
    await user.click(screen.getByRole("button", { name: /mark all read/i }));
    await waitFor(() => expect(allReadSpy).toHaveBeenCalledTimes(1));
  });

  it("pressing ESC closes the dropdown via the modal stack", async () => {
    installHandlers({ count: 1, list: ALL_NOTIFS });
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByTestId("bell-slot"));
    await screen.findByText(NOTIF_UNREAD.title);
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByText(NOTIF_UNREAD.title)).not.toBeInTheDocument(),
    );
  });
});
