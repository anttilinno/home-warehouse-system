import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settingsApi } from "./settings";

// Phase 4 Plan 01 (test-gaps 4.1) — settingsApi unit tests. Stubs global.fetch
// (canonical fetch-mock pattern, mirroring loans.test.ts/photos.test.ts) to
// assert URL/payload shape for profile, preferences, avatar multipart, member
// CRUD, and the blob-download export.

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const USER = { id: "u-1", email: "a@b.com", full_name: "A B" };
const MEMBER = { user_id: "u-1", workspace_id: "ws-1", role: "member" };

describe("settingsApi profile", () => {
  it("getMe fetches /users/me", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(USER));
    await settingsApi.getMe();
    expect(fetchMock.mock.calls[0][0] as string).toContain("/users/me");
  });

  it("updateMe PATCHes /users/me", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(USER));
    await settingsApi.updateMe({ full_name: "New Name" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/users/me");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ full_name: "New Name" }),
    );
  });

  it("updatePreferences PATCHes /users/me/preferences", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(USER));
    await settingsApi.updatePreferences({ theme: "dark" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/users/me/preferences");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(JSON.stringify({ theme: "dark" }));
  });
});

describe("settingsApi.uploadAvatar", () => {
  it("posts multipart with field name 'avatar'", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(USER));
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });

    await settingsApi.uploadAvatar(file);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/users/me/avatar");
    expect((init as RequestInit).method).toBe("POST");
    const body = (init as RequestInit).body as FormData;
    expect(body.get("avatar")).toBeInstanceOf(File);
  });
});

describe("settingsApi.deleteAvatar", () => {
  it("DELETEs /users/me/avatar", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await settingsApi.deleteAvatar();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/users/me/avatar");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});

describe("settingsApi members", () => {
  it("listMembers fetches /workspaces/{id}/members", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [MEMBER] }));
    await settingsApi.listMembers("ws-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/members",
    );
  });

  it("addMemberByEmail POSTs /members with {email, role}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(MEMBER));
    await settingsApi.addMemberByEmail("ws-1", {
      email: "a@b.com",
      role: "member",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/members");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ email: "a@b.com", role: "member" }),
    );
  });

  it("updateMemberRole PATCHes /members/{userId} with {role}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(MEMBER));
    await settingsApi.updateMemberRole("ws-1", "u-1", "admin");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/members/u-1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(JSON.stringify({ role: "admin" }));
  });

  it("removeMember DELETEs /members/{userId}", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await settingsApi.removeMember("ws-1", "u-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/members/u-1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});

describe("settingsApi.exportWorkspace", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue("blob:mock"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: vi.fn(),
    } as unknown as HTMLAnchorElement);
  });

  it("defaults to xlsx format at /export/workspace", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Blob(["z"]), { status: 200 }),
    );
    await settingsApi.exportWorkspace("ws-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/export/workspace?format=xlsx",
    );
  });

  it("honors an explicit json format", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Blob(["z"]), { status: 200 }),
    );
    await settingsApi.exportWorkspace("ws-1", "json");
    expect(fetchMock.mock.calls[0][0] as string).toContain("format=json");
  });
});
