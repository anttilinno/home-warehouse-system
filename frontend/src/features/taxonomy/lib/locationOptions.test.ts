import { describe, expect, it } from "vitest";
import type { Location } from "@/lib/api/location";
import { locationPickerOptions } from "./locationOptions";

const loc = (id: string, name: string, parent?: string): Location =>
  ({ id, name, parent_location: parent }) as Location;

describe("locationPickerOptions", () => {
  it("leaves unique names untouched", () => {
    const opts = locationPickerOptions([
      loc("1", "Koridor"),
      loc("2", "Magamistuba"),
    ]);
    expect(opts).toEqual([
      { value: "1", label: "Koridor" },
      { value: "2", label: "Magamistuba" },
    ]);
  });

  it("suffixes same-name locations with their parent", () => {
    const rows = [
      loc("kor", "Koridor"),
      loc("mag", "Magamistuba"),
      loc("s1", "Seinakapp", "kor"),
      loc("s2", "Seinakapp", "mag"),
    ];
    const byId = Object.fromEntries(
      locationPickerOptions(rows).map((o) => [o.value, o.label]),
    );
    expect(byId.s1).toBe("Seinakapp — Koridor");
    expect(byId.s2).toBe("Seinakapp — Magamistuba");
    // Unique names still clean.
    expect(byId.kor).toBe("Koridor");
  });

  it("does not suffix a duplicate that has no resolvable parent", () => {
    const rows = [loc("a", "Box"), loc("b", "Box", "missing")];
    const labels = locationPickerOptions(rows).map((o) => o.label);
    // parent id not in the set → no suffix (falls back to the bare name).
    expect(labels).toEqual(["Box", "Box"]);
  });
});
