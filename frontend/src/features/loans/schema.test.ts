import { describe, expect, it } from "vitest";
import { loanFormSchema } from "./schema";

// Phase 4 Plan 4.2 (test-gaps) — loanFormSchema validation coverage.
// Mirrors borrowers/schema.test.ts conventions.

const base = {
  inventory_id: "inv-1",
  borrower_id: "b-1",
  due_date: "",
  notes: "",
};

function futureIso(): string {
  const d = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("loanFormSchema — inventory_id / borrower_id", () => {
  it("accepts valid ids", () => {
    expect(loanFormSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an empty inventory_id with 'Inventory entry is required.'", () => {
    const r = loanFormSchema.safeParse({ ...base, inventory_id: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Inventory entry is required.");
    }
  });

  it("rejects an empty borrower_id with 'Borrower is required.'", () => {
    const r = loanFormSchema.safeParse({ ...base, borrower_id: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Borrower is required.");
    }
  });
});

describe("loanFormSchema — due_date", () => {
  it("accepts an absent (empty) due_date", () => {
    expect(loanFormSchema.safeParse({ ...base, due_date: "" }).success).toBe(
      true,
    );
  });

  it("accepts a future due_date", () => {
    const r = loanFormSchema.safeParse({ ...base, due_date: futureIso() });
    expect(r.success).toBe(true);
  });

  it("rejects a past due_date with the cross-field refinement message", () => {
    const r = loanFormSchema.safeParse({ ...base, due_date: "2000-01-01" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Due date can't be in the past.");
      expect(r.error.issues[0].path).toEqual(["due_date"]);
    }
  });
});

describe("loanFormSchema — optional defaults", () => {
  it("defaults due_date/notes to '' when omitted", () => {
    const r = loanFormSchema.safeParse({
      inventory_id: "inv-1",
      borrower_id: "b-1",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.due_date).toBe("");
      expect(r.data.notes).toBe("");
    }
  });

  it("rejects notes over 1000 chars", () => {
    const r = loanFormSchema.safeParse({ ...base, notes: "x".repeat(1001) });
    expect(r.success).toBe(false);
  });
});
