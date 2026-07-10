import { describe, expect, it } from "vitest";
import { newIdemKey } from "./idempotency";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("newIdemKey", () => {
  it("mints a UUID", () => {
    expect(newIdemKey()).toMatch(UUID_RE);
  });

  it("mints a fresh key per call — callers must mint once and persist it in mutation variables, not re-mint on every call, or replay after reconnect would carry a different key each time and defeat backend dedupe", () => {
    expect(newIdemKey()).not.toBe(newIdemKey());
  });
});
