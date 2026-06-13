import { z } from "zod";

// Phase 9 Plan 01 — zod create/edit schema for the borrower form (BORR-02).
//
// Mirrors features/loans/schema.ts: one ALWAYS-ON schema where every optional
// string field defaults to "" so RHF's dirtyFields tracking is meaningful and
// the submit handler can omit-empty (never zero-inject). email is validated
// ONLY when supplied (empty string = absent) — the loan due-date "only-when-
// supplied" discipline; the backend `format:email` is authoritative (T-09-02).
//
// Messages MUST match the UI-SPEC copy (§Form validation messages):
//   "Name is required." / "Enter a valid email address."

export const borrowerFormSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required." }).max(255),
  // Email validated ONLY when supplied (empty = absent).
  email: z
    .string()
    .optional()
    .default("")
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: "Enter a valid email address.",
    }),
  phone: z.string().optional().default(""),
  notes: z.string().max(10000).optional().default(""),
});

// The INPUT shape RHF holds before resolution (the form value type).
export type BorrowerFormInput = z.input<typeof borrowerFormSchema>;
// The RESOLVED (output) shape after zod transforms.
export type BorrowerFormValues = z.infer<typeof borrowerFormSchema>;
