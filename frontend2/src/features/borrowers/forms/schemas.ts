import { z } from "zod";

/**
 * Zod schemas for borrower create and update forms.
 *
 * Length caps align with the UI-SPEC (Phase 59) bounds — name 120, email 254,
 * phone 40, notes 1000. Backend authoritative cap on name is 255 (per
 * handler.go CreateBorrowerInput.Body.Name maxLength:"255"); the stricter UX
 * cap here trims the field before submit. Backend does not currently cap
 * phone/notes/email length — the bounds here are UX-level.
 *
 * `.or(z.literal(""))` on email allows controlled empty inputs in the form
 * without triggering the email-format validator. The submit handler in
 * BorrowerForm (Plan 59-03) coerces "" → undefined before calling the API.
 */

export const borrowerCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required.")
    .max(120, "Must be 120 characters or fewer."),
  email: z
    .string()
    .email("Enter a valid email address.")
    .max(254, "Must be 254 characters or fewer.")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(40, "Must be 40 characters or fewer.")
    .optional(),
  notes: z
    .string()
    .max(1000, "Must be 1000 characters or fewer.")
    .optional(),
});

export const borrowerUpdateSchema = borrowerCreateSchema.partial();

export type BorrowerCreateValues = z.infer<typeof borrowerCreateSchema>;
export type BorrowerUpdateValues = z.infer<typeof borrowerUpdateSchema>;
