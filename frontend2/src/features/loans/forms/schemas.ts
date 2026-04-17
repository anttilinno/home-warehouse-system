import { z } from "zod";

/**
 * Zod schemas for loan create + edit forms.
 *
 * Length / numeric caps mirror the backend (Plan 62-01):
 *   - notes: maxLength:"1000" on both CreateLoanInput.Notes and UpdateLoanInput.Notes
 *   - quantity: integer, 1..999
 *   - inventory_id / borrower_id: UUIDs (required in create)
 *
 * The `.or(z.literal(""))` wrappers on optional date / notes fields let
 * controlled empty inputs pass zod without firing the date format validator;
 * LoanForm coerces "" -> undefined before calling the submit handler
 * (belt-and-suspenders: both in the resolver and on submit, matching
 * BorrowerForm and ItemForm conventions).
 *
 * Cross-field validation (due_date >= loaned_at; loaned_at not > today+1)
 * is handled at submit time in LoanForm — the schemas do not see the sibling
 * fields together for edit mode (loan.loaned_at is only available from the
 * parent component, not from the form values themselves).
 */

export const loanCreateSchema = z.object({
  inventory_id: z.string().uuid("Pick an item."),
  borrower_id: z.string().uuid("Pick a borrower."),
  quantity: z.coerce
    .number({ error: "Whole units only." })
    .int("Whole units only.")
    .min(1, "Quantity must be between 1 and 999.")
    .max(999, "Quantity must be between 1 and 999."),
  loaned_at: z.string().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  notes: z
    .string()
    .max(1000, "Must be 1000 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export const loanEditSchema = z.object({
  due_date: z.string().optional().or(z.literal("")),
  notes: z
    .string()
    .max(1000, "Must be 1000 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export type LoanCreateValues = z.infer<typeof loanCreateSchema>;
export type LoanEditValues = z.infer<typeof loanEditSchema>;
