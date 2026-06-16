import { useRef, useState, type ReactNode } from "react";
import { BevelButton, RetroCheckbox } from "@/components/retro";
import { Popover } from "../overlay";

export interface FilterFacetOption {
  value: string;
  label: ReactNode;
}

export interface FilterPopoverProps {
  /** Facet trigger label (e.g. "Category"); a ▾ glyph is appended. */
  label: ReactNode;
  /** The selectable facet values. */
  options: FilterFacetOption[];
  /** Currently-selected values (controlled). */
  selected: string[];
  /** Called with the next selection on each toggle (multi-select). */
  onChange: (next: string[]) => void;
  className?: string;
}

/**
 * A FilterBar facet trigger + a checklist popover, per UI-SPEC. The checklist
 * is a column of `RetroCheckbox` rows on the Plan 04-01 chromeless `Popover`
 * (role="listbox"). Multi-select keeps the popover open on each toggle; ESC
 * closes EXCLUSIVELY via the shared modal stack (no local document listener).
 */
export function FilterPopover({
  label,
  options,
  selected,
  onChange,
  className = "",
}: Readonly<FilterPopoverProps>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function toggle(value: string, checked: boolean) {
    const next = checked
      ? [...selected, value]
      : selected.filter((v) => v !== value);
    onChange(next);
  }

  return (
    <>
      <BevelButton
        ref={triggerRef}
        variant="neutral"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={className}
      >
        {label} ▾
      </BevelButton>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        role="listbox"
        minWidth={200}
      >
        <div className="flex flex-col gap-sp-1 px-sp-2 py-sp-1">
          {options.map((opt) => (
            <RetroCheckbox
              key={opt.value}
              label={opt.label}
              checked={selected.includes(opt.value)}
              onChange={(e) => toggle(opt.value, e.target.checked)}
            />
          ))}
        </div>
      </Popover>
    </>
  );
}
