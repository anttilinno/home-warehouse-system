import { z } from "zod";

/**
 * Zod schemas for taxonomy (category/location/container) create and update forms.
 *
 * UUID fields use `z.string().uuid().optional()` so the browser rejects
 * malformed parent references before network submit (ASVS V5.1). Length caps
 * mirror backend column sizes — backend remains the source of truth.
 */

export const categoryCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required.")
    .max(120, "Must be 120 characters or fewer."),
  parent_category_id: z.string().uuid().optional(),
  description: z
    .string()
    .max(500, "Must be 500 characters or fewer.")
    .optional(),
});
export const categoryUpdateSchema = categoryCreateSchema.partial();

export const locationCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required.")
    .max(120, "Must be 120 characters or fewer."),
  short_code: z
    .string()
    .max(32, "Must be 32 characters or fewer.")
    .optional(),
  parent_location: z.string().uuid().optional(),
  description: z
    .string()
    .max(500, "Must be 500 characters or fewer.")
    .optional(),
});
export const locationUpdateSchema = locationCreateSchema.partial();

export const containerCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required.")
    .max(120, "Must be 120 characters or fewer."),
  short_code: z
    .string()
    .max(32, "Must be 32 characters or fewer.")
    .optional(),
  location_id: z.string().uuid("Location is required."),
  description: z
    .string()
    .max(500, "Must be 500 characters or fewer.")
    .optional(),
});
export const containerUpdateSchema = containerCreateSchema.partial();

export type CategoryCreateValues = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateValues = z.infer<typeof categoryUpdateSchema>;
export type LocationCreateValues = z.infer<typeof locationCreateSchema>;
export type LocationUpdateValues = z.infer<typeof locationUpdateSchema>;
export type ContainerCreateValues = z.infer<typeof containerCreateSchema>;
export type ContainerUpdateValues = z.infer<typeof containerUpdateSchema>;
