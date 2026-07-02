import type { RetroComboboxOption } from "@/components/retro";
import type { Location } from "@/lib/api/location";

// Build combobox options for a location picker, disambiguating same-name
// locations by their immediate parent. Two wall cupboards named "Seinakapp"
// (one under Koridor, one under Magamistuba) otherwise render as two identical
// "Seinakapp" rows with no way to tell them apart. Only names that collide get
// a " — parent" suffix, so unique names stay clean and the labels stay short
// enough for the PWA's narrow dropdown.
export function locationPickerOptions(
  rows: readonly Location[],
): RetroComboboxOption[] {
  const nameById = new Map(rows.map((l) => [l.id, l.name]));
  const seen = new Set<string>();
  const dupNames = new Set<string>();
  for (const l of rows) {
    if (seen.has(l.name)) dupNames.add(l.name);
    else seen.add(l.name);
  }

  return rows.map((l) => {
    const parent = l.parent_location
      ? nameById.get(l.parent_location)
      : undefined;
    const label =
      dupNames.has(l.name) && parent ? `${l.name} — ${parent}` : l.name;
    return { value: l.id, label };
  });
}
