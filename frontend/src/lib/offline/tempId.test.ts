import { describe, expect, it } from "vitest";
import { isOfflineTempId, newOfflineTempId } from "./tempId";

describe("offline temp id", () => {
  it("mints a prefixed id that is recognized as a temp id", () => {
    const id = newOfflineTempId();
    expect(id.startsWith("offline-")).toBe(true);
    expect(isOfflineTempId(id)).toBe(true);
  });

  it("mints unique ids", () => {
    expect(newOfflineTempId()).not.toBe(newOfflineTempId());
  });

  it("treats a real server id (bare uuid) as not-temp", () => {
    expect(isOfflineTempId(crypto.randomUUID())).toBe(false);
  });

  it("handles nullish ids without throwing", () => {
    expect(isOfflineTempId(undefined)).toBe(false);
    expect(isOfflineTempId(null)).toBe(false);
    expect(isOfflineTempId("")).toBe(false);
  });
});
