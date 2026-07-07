import { BevelButton } from "../BevelButton";
import type { FilterFacet } from "./FilterBar";
import type { FilterDef } from "./filterDefs";
import { FilterPopover } from "./FilterPopover";
import type { FilterState } from "./useUrlFilterState";

// Render a list of FilterDefs into FilterBar facet triggers, bound to a
// FilterState. Enum defs become single/multi checklist popovers; boolean defs
// become pressed-toggle BevelButtons. Every def is a permanently-visible
// toolbar trigger (discoverable), and its active value shows as a removable
// chip in the FilterBar chip row.
export function filterFacetsFor(
  defs: FilterDef[],
  state: FilterState,
): FilterFacet[] {
  return defs.map((def) => {
    if (def.kind === "boolean") {
      const active = (state.values[def.key] ?? []).length > 0;
      return {
        key: def.key,
        label: def.label,
        trigger: (
          <BevelButton
            variant="neutral"
            aria-pressed={active}
            className={active ? "bevel-pressed bg-bg-pressed" : ""}
            onClick={() => state.set(def.key, active ? [] : ["1"])}
          >
            {def.label}
          </BevelButton>
        ),
      };
    }
    return {
      key: def.key,
      label: def.label,
      trigger: (
        <FilterPopover
          label={def.label}
          options={def.options}
          selected={state.values[def.key] ?? []}
          single={!def.multi}
          onChange={(next) => state.set(def.key, next)}
        />
      ),
    };
  });
}
