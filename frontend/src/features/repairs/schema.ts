import { z } from "zod";

// Phase 10b Plan 01 — RHF+zod create/edit schema for the repair form (mirrors
// features/loans/schema.ts: one ALWAYS-ON schema, string fields default to "" so
// RHF dirtyFields tracking distinguishes "" untouched from a real value).
//
// COST is the load-bearing transform (UI-SPEC §Cents rule / T-10b-01): the user
// types a MAJOR-unit string (e.g. "42.50"); zod transforms it to an integer
// CENTS value via Math.round(value * 100) — a float NEVER reaches the API. An
// empty cost is OMITTED (transformed to undefined), never zero-injected. The
// <input> uses inputMode="decimal".

// Major-unit currency text → CENTS int | undefined. "" / whitespace → undefined.
// A non-numeric string is a validation error.
const costToCents = z
  .string()
  .optional()
  .default("")
  .transform((v, ctx) => {
    const trimmed = v.trim();
    if (trimmed === "") return undefined;
    const major = Number(trimmed);
    if (!Number.isFinite(major) || major < 0) {
      ctx.addIssue({
        code: "custom",
        message: "Cost must be a non-negative amount.",
      });
      return z.NEVER;
    }
    return Math.round(major * 100);
  });

export const repairFormSchema = z.object({
  // Required free-text description.
  description: z.string().min(1, { message: "Description is required." }),
  // Optional repair date (YYYY-MM-DD). "" = absent.
  repair_date: z.string().optional().default(""),
  // Optional cost — major-unit string in, CENTS int (or undefined) out.
  cost: costToCents,
  // Optional currency (ISO). "" = absent → caller defaults.
  currency_code: z.string().optional().default(""),
  // Optional service provider free text.
  service_provider: z.string().optional().default(""),
  // Optional warranty-claim flag.
  is_warranty_claim: z.boolean().optional().default(false),
  // Optional reminder date (YYYY-MM-DD). "" = absent.
  reminder_date: z.string().optional().default(""),
});

// The RESOLVED (output) shape after zod transforms (cost is number | undefined).
export type RepairFormValues = z.infer<typeof repairFormSchema>;

// The INPUT shape RHF holds before resolution (cost is a string).
export type RepairFormInput = z.input<typeof repairFormSchema>;
