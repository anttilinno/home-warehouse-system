import { useMemo, useState, type ReactNode } from "react";
import { RetroCombobox, type RetroComboboxOption } from "@/components/retro";
import {
  useTaxonomySearch,
  type SearchDomain,
} from "../hooks/useTaxonomySearch";

// Phase 10 Plan 03 — Taxonomy-ONLY type-ahead picker. Do NOT import into shipped
// item/inventory/loan forms (RESEARCH OQ4 RISK — those use the native-select
// usePickerOptions path; the SSE/search wiring here is taxonomy-specific).
//
// Composes RetroCombobox with useTaxonomySearch(domain, query): the debounced
// /search results layer on top of an optional `fallbackOptions` baseline (the
// already-loaded domain list) so the picker is usable before the user types AND
// the currently-selected value always resolves to a readable label. value /
// onChange are the RHF Controller surface (controlled id in, id out).

export interface SearchPickerProps {
  label: ReactNode;
  /** Which /search endpoint to hit: /locations/search | /containers/search. */
  domain: SearchDomain;
  /** Controlled selected id. */
  value: string;
  onChange: (value: string) => void;
  /**
   * Baseline options shown before the user types (and to resolve the selected
   * label). The live /search results are merged on top, de-duped by id.
   */
  fallbackOptions?: RetroComboboxOption[];
  error?: ReactNode;
  disabled?: boolean;
  placeholder?: string;
}

export function SearchPicker({
  label,
  domain,
  value,
  onChange,
  fallbackOptions = [],
  error,
  disabled = false,
  placeholder,
}: SearchPickerProps) {
  // The typed query drives the debounced /search. RetroCombobox owns the input
  // display; this mirror lets the hook fire as the user types.
  const [query, setQuery] = useState("");
  const { options: searchOptions } = useTaxonomySearch(domain, query);

  // Merge baseline + live results, de-duped by id (live results win on label).
  const options = useMemo<RetroComboboxOption[]>(() => {
    const byId = new Map<string, RetroComboboxOption>();
    for (const o of fallbackOptions) byId.set(o.value, o);
    for (const o of searchOptions) byId.set(o.value, o);
    return [...byId.values()];
  }, [fallbackOptions, searchOptions]);

  return (
    <div onInput={(e) => setQuery((e.target as HTMLInputElement).value ?? "")}>
      <RetroCombobox
        label={label}
        options={options}
        value={value}
        onChange={onChange}
        error={error}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}
