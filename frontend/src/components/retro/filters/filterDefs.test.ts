import { describe, expect, it } from "vitest";
import { type FilterDef, chipsForDefs, readFilterValues } from "./filterDefs";

const DEFS: FilterDef[] = [
  {
    key: "category",
    label: "Category",
    kind: "enum",
    options: [
      { value: "c1", label: "Tools" },
      { value: "c2", label: "Consumables" },
    ],
  },
  {
    key: "status",
    label: "Status",
    kind: "enum",
    multi: true,
    options: [
      { value: "a", label: "Available" },
      { value: "b", label: "On loan" },
    ],
  },
  { key: "insured", label: "Insured", kind: "boolean" },
];

describe("readFilterValues", () => {
  it("decodes single-enum, multi-enum, and boolean params; absent → empty", () => {
    const params = new URLSearchParams("category=c1&status=a,b&insured=1");
    expect(readFilterValues(DEFS, params)).toEqual({
      category: ["c1"],
      status: ["a", "b"],
      insured: ["1"],
    });
  });

  it("treats any present boolean param as on, and missing params as empty", () => {
    const params = new URLSearchParams("insured=1");
    const v = readFilterValues(DEFS, params);
    expect(v.insured).toEqual(["1"]);
    expect(v.category).toEqual([]);
    expect(v.status).toEqual([]);
  });
});

describe("chipsForDefs", () => {
  it("maps enum values to option LABELS (not raw ids) and booleans to Yes", () => {
    const chips = chipsForDefs(DEFS, {
      category: ["c1"],
      status: ["a", "b"],
      insured: ["1"],
    });
    expect(chips).toEqual([
      { key: "category", label: "Category", displayValue: "Tools" },
      { key: "status", label: "Status", displayValue: "Available, On loan" },
      { key: "insured", label: "Insured", displayValue: "Yes" },
    ]);
  });

  it("falls back to the raw value when an option is unknown, and skips empty defs", () => {
    const chips = chipsForDefs(DEFS, { category: ["ghost"], status: [] });
    expect(chips).toEqual([
      { key: "category", label: "Category", displayValue: "ghost" },
    ]);
  });

  it("honors a localized yesLabel", () => {
    const chips = chipsForDefs(DEFS, { insured: ["1"] }, "Jah");
    expect(chips[0].displayValue).toBe("Jah");
  });
});
