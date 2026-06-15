import { z } from "zod";

// Phase 10 Plan 01 — zod create/edit schemas for the four taxonomy domains.
// Mirrors features/borrowers/schema.ts idiom: one ALWAYS-ON schema per domain
// where optional string fields default to "" so RHF dirtyFields tracking is
// meaningful and the submit handler can omit-empty (never zero-inject).
//
// Constraints mirror the server contract (V5 Input Validation):
//   - name: 1..255 (required)
//   - color (labels): hex ^#[0-9A-Fa-f]{6}$ — matches label/handler.go:280
//   - short_code (locations/containers): ^[A-Za-z0-9]{4,8}$ when supplied
//   - container.location_id: required (min 1)
//   - parent fields optional (empty = root)
//
// Messages match the UI-SPEC validation copy.

const name = z
  .string()
  .trim()
  .min(1, { message: "Name is required." })
  .max(255);
const description = z.string().max(10000).optional().default("");

// Color validated ONLY when supplied (empty string = absent / no color).
const color = z
  .string()
  .optional()
  .default("")
  .refine((v) => !v || /^#[0-9A-Fa-f]{6}$/.test(v), {
    message: "Enter a valid hex color (e.g. #b73348).",
  });

// short_code validated ONLY when supplied (auto-generated server-side if blank).
const shortCode = z
  .string()
  .optional()
  .default("")
  .refine((v) => !v || /^[A-Za-z0-9]{4,8}$/.test(v), {
    message: "Short code must be 4-8 letters or digits.",
  });

export const categorySchema = z.object({
  name,
  parent_category_id: z.string().optional().default(""), // empty = root
  description,
});

export const locationSchema = z.object({
  name,
  parent_location: z.string().optional().default(""), // empty = root (NOT _id)
  description,
  short_code: shortCode,
});

export const containerSchema = z.object({
  name,
  location_id: z.string().min(1, { message: "Location is required." }),
  description,
  short_code: shortCode,
});

export const labelSchema = z.object({
  name,
  color,
  description,
});

export type CategoryFormInput = z.input<typeof categorySchema>;
export type CategoryFormValues = z.infer<typeof categorySchema>;
export type LocationFormInput = z.input<typeof locationSchema>;
export type LocationFormValues = z.infer<typeof locationSchema>;
export type ContainerFormInput = z.input<typeof containerSchema>;
export type ContainerFormValues = z.infer<typeof containerSchema>;
export type LabelFormInput = z.input<typeof labelSchema>;
export type LabelFormValues = z.infer<typeof labelSchema>;
