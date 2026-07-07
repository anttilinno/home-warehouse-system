import type { FilterChip } from "./FilterBar";

// Generic filter model (Phase-14 filter system). A page declares a list of
// FilterDefs; the adapter hook (useUrlFilterState) turns them into URL-backed
// state, and filterFacetsFor renders the toolbar triggers. The model is pure
// data so a future client-side adapter (inventory/loans) can reuse it verbatim.

export interface FilterOption {
  value: string;
  /** Human label (already localized by the caller). */
  label: string;
  /** Tree indent level for hierarchical enums (0 = root). */
  depth?: number;
}

export type FilterDef =
  | {
      key: string;
      /** Localized facet label — also the chip label. */
      label: string;
      kind: "enum";
      options: FilterOption[];
      /** Multi-select checklist; default (undefined/false) = single-select. */
      multi?: boolean;
    }
  | { key: string; label: string; kind: "boolean" };

/** def.key → selected values (a boolean def is `["1"]` when on, `[]` when off). */
export type FilterValues = Record<string, string[]>;

/** Decode the active values for `defs` out of URL search params. Pure. */
export function readFilterValues(
  defs: FilterDef[],
  params: URLSearchParams,
): FilterValues {
  const out: FilterValues = {};
  for (const def of defs) {
    const raw = params.get(def.key);
    if (!raw) {
      out[def.key] = [];
    } else if (def.kind === "boolean") {
      out[def.key] = ["1"];
    } else if (def.multi) {
      out[def.key] = raw.split(",").filter(Boolean);
    } else {
      out[def.key] = [raw];
    }
  }
  return out;
}

/**
 * Pure: values → human-readable active-filter chips. An enum chip's display
 * value is its option label(s) (NOT the raw id/value); a boolean chip shows
 * `yesLabel`. The caller supplies `yesLabel` already localized.
 */
export function chipsForDefs(
  defs: FilterDef[],
  values: FilterValues,
  yesLabel = "Yes",
): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const def of defs) {
    const vals = values[def.key] ?? [];
    if (vals.length === 0) continue;
    let displayValue: string;
    if (def.kind === "boolean") {
      displayValue = yesLabel;
    } else {
      displayValue = vals
        .map((v) => def.options.find((o) => o.value === v)?.label ?? v)
        .join(", ");
    }
    chips.push({ key: def.key, label: def.label, displayValue });
  }
  return chips;
}
