import { z } from "zod";

// Phase 8 Plan 03 — zod create schema for the /loans/new form (LOAN-02).
//
// Mirrors the inventory entry schema's input/output split (schema.ts): one
// ALWAYS-ON schema, string fields default to "" so RHF's dirtyFields tracking is
// meaningful and the dirty-guard can tell "" (untouched) from a real value.
//
// The wire field is `inventory_id`, NEVER `item_id` (Pitfall 1 / override 1): a
// loan is taken against a specific stocked inventory entry, not the abstract
// item. quantity is fixed at 1 this phase (NOT a user field — the create body
// injects it in the mutation) so it is intentionally absent from this schema.
//
// due_date is a YYYY-MM-DD string (the <input type="date"> value); the form
// serializes a non-empty value to RFC3339 on submit. An absent date is OMITTED,
// never zero-injected. The past-date guard is a client zod refinement (UI-SPEC
// §2 cross-field — "Due date can't be in the past.") that ONLY fires when a date
// is supplied; the server is authoritative (T-08-VAL).

// Today as YYYY-MM-DD for the past-date refinement. Local-date based (matches
// what the <input type="date"> shows the user); lexical compare is safe for
// zero-padded YYYY-MM-DD.
function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const loanFormSchema = z
  .object({
    // Required ids — RetroSelect-backed, sourced from the workspace picker lists.
    // inventory_id is the inventory ENTRY id (NOT item_id — Pitfall 1).
    inventory_id: z
      .string()
      .min(1, { message: "Inventory entry is required." }),
    borrower_id: z.string().min(1, { message: "Borrower is required." }),
    // Optional due date (YYYY-MM-DD). "" = absent.
    due_date: z.string().optional().default(""),
    // Optional free text.
    notes: z.string().max(1000).optional().default(""),
  })
  // Cross-field: a due date earlier than today is a client error. Only enforced
  // when a date is supplied (UI-SPEC §2).
  .refine((v) => !v.due_date || v.due_date >= todayIso(), {
    message: "Due date can't be in the past.",
    path: ["due_date"],
  });

// The RESOLVED (output) shape after zod transforms.
export type LoanFormValues = z.infer<typeof loanFormSchema>;

// The INPUT shape RHF holds before resolution. Used as the form's value type.
export type LoanFormInput = z.input<typeof loanFormSchema>;
