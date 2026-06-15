import { z } from "zod";

// Phase 7 Plan 05 — zod create/edit schema for the item form.
//
// Field set mirrors the backend ItemResponse fields this form actually writes
// (07-RESEARCH / handler.go createItemInput): name (required), description,
// barcode (all `*string` on PATCH → clearable with ""), and minStock
// (min_stock_level, `*int`). category/location are display-only free-text values
// here: no taxonomy API/hook exists yet (verified — src/lib/api has no
// categories/locations), and category_id is a backend uuid that can NOT be set
// from a free-typed string, so those values are captured for UX continuity but
// NOT submitted (documented stub — see useItemFormMutations + SUMMARY).
//
// All string fields default to "" (not undefined) so RHF's dirtyFields tracking
// is meaningful and the edit PATCH builder can tell "" (cleared) from an
// untouched field via RHF's dirtyFields map (Pitfall 4 — omitted=unchanged,
// ""=clear). minStock is a coerced optional number ≥ 0.

export const itemFormSchema = z.object({
  // Required — backend createItemInput SKU minLength:1 maxLength:255
  // (handler.go:747). Validation is ALWAYS on (one schema): in CREATE it's an
  // editable required field; in EDIT the SKU is immutable (no `sku` on the
  // backend PATCH input), so the field is shown read-only and never enters the
  // PATCH builder — but the resolver still keeps it valid because edit-mode
  // reset prefills `sku` from the loaded item. D-07-07-A: omitting this caused
  // form-driven create to 422.
  sku: z
    .string()
    .trim()
    .min(1, { message: "SKU is required." })
    .max(255, { message: "SKU is too long (max 255)." }),
  // Required — backend minLength:1. Trimmed-empty is rejected with a friendly
  // message; the form surfaces it via the RetroFormField error treatment.
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required." })
    .max(255, { message: "Name is too long (max 255)." }),
  // Optional string fields. Empty string is a valid "no value / cleared" state.
  description: z.string().max(10000).optional().default(""),
  barcode: z.string().max(255).optional().default(""),
  // Free-text display values (NOT submitted — no taxonomy uuid resolution yet).
  category: z.string().optional().default(""),
  location: z.string().optional().default(""),
  // min_stock_level — coerced from the numeric input. Optional; ≥ 0 when present.
  // An empty input coerces to undefined (omitted), not 0, so an untouched create
  // lets the backend apply its default:0.
  minStock: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isNaN(n) ? undefined : n;
    })
    .pipe(
      z.number().min(0, { message: "Quantity can't be negative." }).optional(),
    ),
});

// The RESOLVED (output) shape after zod transforms — minStock is number|undefined.
export type ItemFormValues = z.infer<typeof itemFormSchema>;

// The INPUT shape RHF holds before resolution — minStock arrives as a string
// from the number input. Used as the form's value type so the resolver can
// coerce on submit.
export type ItemFormInput = z.input<typeof itemFormSchema>;
