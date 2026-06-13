import { z } from "zod";
import { CONDITIONS, STATUSES } from "./inventoryEnums";

// Phase 7b Plan 03 — zod create/edit schema for the inventory entry form.
//
// Mirrors the Phase 7 item schema (items/schema.ts) but over the inventory
// contract. One ALWAYS-ON schema serves both create and edit:
//   - CREATE sends status (createInventoryInput requires it);
//   - EDIT (full PATCH) OMITS status (Pitfall 6 — status is exclusively the
//     dedicated /status route). The edit body-builder drops status, but the
//     resolver still validates it because edit-mode reset prefills a real value.
//
// String fields default to "" (not undefined) so RHF's dirtyFields tracking is
// meaningful and the PATCH builder can tell "" (cleared) from omitted
// (unchanged) — Pitfall 4. quantity is coerced from the numeric input and must
// be >= 1 (create + full-PATCH enforce >= 1; the inline quantity route is the
// >= 0 path — Pitfall 5, owned by Plan 02).
//
// Dates are YYYY-MM-DD strings here (the <input type="date"> value); the
// body-builder serializes a non-empty date to RFC3339 (T00:00:00Z) on submit
// because the backend binds *time.Time. Absent dates are OMITTED, never
// zero-injected (Pitfall 4/7).

export const inventoryFormSchema = z
  .object({
    // Required ids — RetroSelect-backed, sourced from the workspace picker lists.
    item_id: z.string().min(1, { message: "Item is required." }),
    location_id: z.string().min(1, { message: "Location is required." }),
    // Optional container — "" is the "— No container" choice.
    container_id: z.string().optional().default(""),
    // Quantity — coerced from the number input. Create/full-PATCH require >= 1.
    quantity: z
      .union([z.string(), z.number()])
      .transform((v) => {
        if (v === "" || v === undefined || v === null) return NaN;
        return typeof v === "number" ? v : Number(v);
      })
      .pipe(
        z
          .number({ message: "Quantity is required." })
          .int({ message: "Quantity must be a whole number." })
          .min(1, { message: "Quantity must be at least 1." }),
      ),
    // Enums — Title-Case rendered via STATUS_LABEL/CONDITION_LABEL; the wire
    // value is the enum member. Out-of-enum is rejected.
    condition: z.enum(CONDITIONS as [string, ...string[]], {
      message: "Condition is required.",
    }),
    status: z.enum(STATUSES as [string, ...string[]], {
      message: "Status is required.",
    }),
    // Optional date strings (YYYY-MM-DD). "" = absent.
    date_acquired: z.string().optional().default(""),
    warranty_expires: z.string().optional().default(""),
    expiration_date: z.string().optional().default(""),
    // Optional free text.
    notes: z.string().max(10000).optional().default(""),
  })
  // Cross-field: an expiry earlier than the acquired date is a client error.
  // Only enforced when BOTH dates are present (lexical compare is safe for
  // zero-padded YYYY-MM-DD).
  .refine(
    (v) =>
      !v.date_acquired ||
      !v.expiration_date ||
      v.expiration_date >= v.date_acquired,
    {
      message: "Expiry can't be before the acquired date.",
      path: ["expiration_date"],
    },
  );

// The RESOLVED (output) shape after zod transforms — quantity is a number.
export type InventoryFormValues = z.infer<typeof inventoryFormSchema>;

// The INPUT shape RHF holds before resolution — quantity arrives as a string
// from the number input. Used as the form's value type so the resolver coerces
// on submit.
export type InventoryFormInput = z.input<typeof inventoryFormSchema>;
