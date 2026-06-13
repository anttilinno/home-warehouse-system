import { describe, expect, it } from "vitest";
import { borrowerFormSchema } from "./schema";

// Phase 9 Plan 01 Task 2 — borrower zod schema validation. Mirrors the loans
// schema's input/output discipline: optional string fields default to "" (so
// RHF dirtyFields + omit-empty-on-submit are meaningful), and email is validated
// ONLY when supplied. Messages MUST match the UI-SPEC copy (§Form validation):
// "Name is required." / "Enter a valid email address."

const base = { name: "Alex", email: "", phone: "", notes: "" };

describe("borrowerFormSchema — name", () => {
  it("accepts a valid name", () => {
    expect(borrowerFormSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an empty name with 'Name is required.'", () => {
    const r = borrowerFormSchema.safeParse({ ...base, name: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Name is required.");
    }
  });

  it("rejects a whitespace-only name (trimmed) with 'Name is required.'", () => {
    const r = borrowerFormSchema.safeParse({ ...base, name: "   " });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Name is required.");
    }
  });

  it("rejects a name over 255 chars", () => {
    const r = borrowerFormSchema.safeParse({ ...base, name: "x".repeat(256) });
    expect(r.success).toBe(false);
  });

  it("accepts a name of exactly 255 chars", () => {
    const r = borrowerFormSchema.safeParse({ ...base, name: "x".repeat(255) });
    expect(r.success).toBe(true);
  });
});

describe("borrowerFormSchema — email (only-when-supplied)", () => {
  it("accepts an absent (empty) email", () => {
    expect(borrowerFormSchema.safeParse({ ...base, email: "" }).success).toBe(
      true,
    );
  });

  it("rejects a malformed email with 'Enter a valid email address.'", () => {
    const r = borrowerFormSchema.safeParse({ ...base, email: "not-an-email" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Enter a valid email address.");
    }
  });

  it("accepts a valid email", () => {
    expect(
      borrowerFormSchema.safeParse({ ...base, email: "a@x.io" }).success,
    ).toBe(true);
  });
});

describe("borrowerFormSchema — optional defaults", () => {
  it("defaults phone/notes/email to '' when omitted", () => {
    const r = borrowerFormSchema.safeParse({ name: "Alex" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("");
      expect(r.data.phone).toBe("");
      expect(r.data.notes).toBe("");
    }
  });

  it("accepts arbitrary phone / notes strings", () => {
    const r = borrowerFormSchema.safeParse({
      ...base,
      phone: "+1 (555) 123-4567",
      notes: "lives next door",
    });
    expect(r.success).toBe(true);
  });
});
