import { z } from "zod";

export const createItemSchema = z.object({
  // Step 1: Basic (required)
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  category_id: z.string().optional(),
  description: z.string().optional(),

  // Step 2: Details
  brand: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  serial_number: z.string().optional(),
  barcode: z.string().optional(),
  purchased_from: z.string().optional(),

  // Step 2: Inventory (in collapsible)
  min_stock_level: z.coerce.number().min(0).default(0),

  // Step 2: Advanced (in collapsible)
  is_insured: z.boolean().default(false),
  lifetime_warranty: z.boolean().default(false),
  warranty_details: z.string().optional(),
  short_code: z.string().optional(),
});

export type CreateItemFormData = z.infer<typeof createItemSchema>;

// Default values matching schema
export const createItemDefaults: CreateItemFormData = {
  sku: "",
  name: "",
  category_id: undefined,
  description: "",
  brand: "",
  model: "",
  manufacturer: "",
  serial_number: "",
  barcode: "",
  purchased_from: "",
  min_stock_level: 0,
  is_insured: false,
  lifetime_warranty: false,
  warranty_details: "",
  short_code: "",
};

// Fields validated on each step
export const stepFields: (keyof CreateItemFormData)[][] = [
  ["sku", "name"], // Step 1: Basic
  [], // Step 2: Details (all optional)
  [], // Step 3: Photos (handled separately)
];
