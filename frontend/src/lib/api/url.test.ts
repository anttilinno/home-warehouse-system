import { describe, expect, it } from "vitest";
import { toProxyUrl } from "./url";

// Phase 7 Plan 01 Task 1 — proves the absolute→/api-relative rewrite and its
// open-redirect guard (threat T-07-01). The backend emits photo URLs as
// absolute http://localhost:8080/workspaces/... (07-RESEARCH Pitfall 1); these
// MUST be neutralized to a same-origin /api-relative path before any <img> sees
// them, and a foreign/attacker-controlled host must never survive the rewrite.

describe("toProxyUrl", () => {
  it("rewrites an absolute localhost:8080 backend URL to /api-relative", () => {
    const input = "http://localhost:8080/workspaces/ws-1/items/it-1/photos/p-1";
    expect(toProxyUrl(input)).toBe(
      "/api/workspaces/ws-1/items/it-1/photos/p-1",
    );
  });

  it("preserves the query string while dropping scheme+host", () => {
    const input =
      "http://localhost:8080/workspaces/ws-1/photos/p-1/thumbnail?v=2";
    expect(toProxyUrl(input)).toBe(
      "/api/workspaces/ws-1/photos/p-1/thumbnail?v=2",
    );
  });

  it("drops a foreign attacker-controlled host (open-redirect guard)", () => {
    // Only u.pathname+u.search survive; scheme+host are discarded, so the
    // result can never point at evil.example. It always begins "/api/".
    const input = "https://evil.example/workspaces/ws-1/items/it-1";
    const out = toProxyUrl(input);
    expect(out).toBe("/api/workspaces/ws-1/items/it-1");
    expect(out.startsWith("/api/")).toBe(true);
    expect(out).not.toContain("evil.example");
  });

  it("returns an already-relative input unchanged (parse failure path)", () => {
    const input = "/api/workspaces/ws-1/items/it-1";
    expect(toProxyUrl(input)).toBe(input);
  });

  it("returns a non-URL string unchanged", () => {
    expect(toProxyUrl("not a url")).toBe("not a url");
  });
});
