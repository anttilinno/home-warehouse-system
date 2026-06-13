import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";
import { MembersPage } from "./MembersPage";

// Phase 12 Plan 06 — SETT-10. Members page: list (name/email/role) + per-row
// role change (PATCH) + remove (pink confirm → DELETE) + add-by-email
// (POST {email, role}). Server is authoritative for own-role-change (400),
// last-owner removal (400), unregistered email (404), already-member (400);
// the client mirrors them for UX and surfaces the server error on miss.

// Mock useWorkspace so the page has a wsId without booting a WorkspaceProvider
// (which would fetch the workspace list). The real binding is exercised in the
// E2E plan (12-07).
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => ({ currentWorkspaceId: "ws-1" }),
}));

const ME_PATH = "/api/users/me";
const MEMBERS_PATH = "/api/workspaces/ws-1/members";

// The current user (own row). MEMBER own-row detection compares user_id to me.id.
const ME = {
  id: "user-1",
  email: "owner@test.local",
  full_name: "Olive Owner",
  has_password: true,
  avatar_url: null,
};

const OWN_MEMBER = {
  id: "mem-1",
  workspace_id: "ws-1",
  user_id: "user-1",
  role: "owner",
  email: "owner@test.local",
  full_name: "Olive Owner",
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

const OTHER_MEMBER = {
  id: "mem-2",
  workspace_id: "ws-1",
  user_id: "user-2",
  role: "member",
  email: "ada@example.com",
  full_name: "Ada Lovelace",
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={freshClient()}>
        <ModalStackProvider>
          <MembersPage />
          <RetroToaster />
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

function seedTwoMembers() {
  server.use(
    http.get(ME_PATH, () => HttpResponse.json(ME)),
    http.get(MEMBERS_PATH, () =>
      HttpResponse.json({ items: [OWN_MEMBER, OTHER_MEMBER] }),
    ),
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

describe("MembersPage — list / role / remove (SETT-10)", () => {
  it("list shows name, email and role per member", async () => {
    seedTwoMembers();
    renderPage();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("Olive Owner")).toBeInTheDocument();
    expect(screen.getByText("owner@test.local")).toBeInTheDocument();
  });

  it("empty list renders the RetroEmptyState", async () => {
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME)),
      http.get(MEMBERS_PATH, () => HttpResponse.json({ items: [] })),
    );
    renderPage();

    expect(await screen.findByText("No members yet")).toBeInTheDocument();
  });

  it("own row is tagged YOU; its role select is disabled and it has no Remove", async () => {
    seedTwoMembers();
    renderPage();

    const youBadge = await screen.findByText("YOU");
    const ownRow = youBadge.closest("tr")!;
    expect(
      within(ownRow).getByRole("combobox", { name: /role for/i }),
    ).toBeDisabled();
    expect(
      within(ownRow).queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument();
  });

  it("changing the other member's role PATCHes the role", async () => {
    seedTwoMembers();
    let patched: { userId: string; body: unknown } | null = null;
    server.use(
      http.patch(
        "/api/workspaces/ws-1/members/:userId",
        async ({ params, request }) => {
          patched = {
            userId: params.userId as string,
            body: await request.json(),
          };
          return HttpResponse.json({ ...OTHER_MEMBER, role: "admin" });
        },
      ),
    );
    renderPage();

    const otherRow = (await screen.findByText("Ada Lovelace")).closest("tr")!;
    const select = within(otherRow).getByRole("combobox", { name: /role for/i });
    await userEvent.selectOptions(select, "admin");

    await waitFor(() => expect(patched).not.toBeNull());
    expect(patched!.userId).toBe("user-2");
    expect(patched!.body).toEqual({ role: "admin" });
  });

  it("removing the other member confirms then DELETEs", async () => {
    seedTwoMembers();
    let deleted: string | null = null;
    server.use(
      http.delete("/api/workspaces/ws-1/members/:userId", ({ params }) => {
        deleted = params.userId as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage();

    const otherRow = (await screen.findByText("Ada Lovelace")).closest("tr")!;
    await userEvent.click(
      within(otherRow).getByRole("button", { name: /remove/i }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/they'll lose access immediately/i),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^remove$/i }),
    );

    await waitFor(() => expect(deleted).toBe("user-2"));
  });

  it("a 400 on remove (last owner) surfaces a danger toast", async () => {
    seedTwoMembers();
    server.use(
      http.delete("/api/workspaces/ws-1/members/:userId", () =>
        HttpResponse.json(
          { detail: "cannot remove the last owner" },
          { status: 400 },
        ),
      ),
    );
    renderPage();

    const otherRow = (await screen.findByText("Ada Lovelace")).closest("tr")!;
    await userEvent.click(
      within(otherRow).getByRole("button", { name: /remove/i }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^remove$/i }),
    );

    expect(
      await screen.findByText(/can't remove the last owner/i),
    ).toBeInTheDocument();
  });
});

describe("MembersPage — add by email (SETT-10)", () => {
  it("submitting the add form POSTs { email, role } and invalidates", async () => {
    seedTwoMembers();
    let posted: unknown = null;
    server.use(
      http.post(MEMBERS_PATH, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ ...OTHER_MEMBER, id: "mem-3" });
      }),
    );
    renderPage();

    await screen.findByText("Ada Lovelace");
    await userEvent.type(
      screen.getByRole("textbox", { name: /email/i }),
      "newbie@example.com",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /role for new member/i }),
      "admin",
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toEqual({ email: "newbie@example.com", role: "admin" });
  });

  it("a 404 (unregistered email) surfaces the no-registered-user message", async () => {
    seedTwoMembers();
    server.use(
      http.post(MEMBERS_PATH, () =>
        HttpResponse.json(
          { detail: "no registered user with that email" },
          { status: 404 },
        ),
      ),
    );
    renderPage();

    await screen.findByText("Ada Lovelace");
    await userEvent.type(
      screen.getByRole("textbox", { name: /email/i }),
      "ghost@example.com",
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(
      await screen.findByText(/no registered user with that email/i),
    ).toBeInTheDocument();
  });

  it("a 400 (already a member) surfaces the already-member message", async () => {
    seedTwoMembers();
    server.use(
      http.post(MEMBERS_PATH, () =>
        HttpResponse.json(
          { detail: "user is already a member" },
          { status: 400 },
        ),
      ),
    );
    renderPage();

    await screen.findByText("Ada Lovelace");
    await userEvent.type(
      screen.getByRole("textbox", { name: /email/i }),
      "ada@example.com",
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(
      await screen.findByText(/already a member/i),
    ).toBeInTheDocument();
  });
});
