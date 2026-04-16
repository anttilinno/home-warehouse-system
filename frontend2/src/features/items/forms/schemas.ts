import { z } from "zod";

/**
 * Item form zod schemas for Phase 60 CRUD.
 *
 * Field caps per 60-UI-SPEC:
 *  - name: required, max 200
 *  - sku: required, max 64, pattern [A-Za-z0-9_-]+
 *  - barcode: optional, max 64, pattern [A-Za-z0-9]+
 *  - description: optional, max 2000
 *  - category_id: optional, UUID
 *
 * UX caps are stricter than backend caps (255 for most fields) — this is
 * intentional (UX-level hygiene) and the backend is the authoritative guard.
 *
 * Optional string fields use `.optional().or(z.literal(""))` so an empty input
 * does not produce a UUID/pattern validation error. The form resolver wrapper
 * (ItemForm) then coerces "" → undefined before submit.
 */

export const itemCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required.")
    .max(200, "Must be 200 characters or fewer."),
  sku: z
    .string()
    .min(1, "SKU is required.")
    .max(64, "Must be 64 characters or fewer.")
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens, or underscores only."),
  barcode: z
    .string()
    .max(64, "Must be 64 characters or fewer.")
    .regex(/^[A-Za-z0-9]+$/, "Use letters and numbers only.")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(2000, "Must be 2000 characters or fewer.")
    .optional()
    .or(z.literal("")),
  category_id: z
    .string()
    .uuid("Pick a category from the list.")
    .optional()
    .or(z.literal("")),
});

export const itemUpdateSchema = itemCreateSchema.partial();

export type ItemCreateValues = z.infer<typeof itemCreateSchema>;
export type ItemUpdateValues = z.infer<typeof itemUpdateSchema>;

/**
 * generateSku — client-side deterministic-ish SKU generator.
 *
 * Pattern: ITEM-{base36 timestamp, UPPER}-{4 char base36, UPPER}
 * Example: ITEM-LM7F3K2P-4F2A
 *
 * Collision probability: ~1/1,679,616 per millisecond. Server enforces
 * uniqueness via UNIQUE(workspace_id, sku) constraint and returns 400
 * (ErrSKUTaken) on collision. useCreateItem surfaces a specific toast on that
 * 400 (Pitfall 6).
 */
export function generateSku(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1_679_616) // 36^4
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `ITEM-${ts}-${rand}`;
}
