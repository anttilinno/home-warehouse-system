import { useRef, useState, type ReactNode } from "react";
import { BevelButton, PixelIcon, RetroCheckbox } from "@/components/retro";
import { Popover } from "../overlay";

export interface FilterFacetOption {
  value: string;
  label: ReactNode;
  /** Tree indent level (0 = root); indents the checklist row when set. */
  depth?: number;
}

export interface FilterPopoverProps {
  /** Facet trigger label (e.g. "Category"); a ▾ glyph is appended. */
  label: ReactNode;
  /** The selectable facet values. */
  options: FilterFacetOption[];
  /** Currently-selected values (controlled). */
  selected: string[];
  /** Called with the next selection on each toggle. */
  onChange: (next: string[]) => void;
  /**
   * Single-select: toggling a value replaces the selection with just that
   * value and closes the popover; unchecking clears it. Default = multi.
   */
  single?: boolean;
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
  single = false,
  className = "",
}: Readonly<FilterPopoverProps>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function toggle(value: string, checked: boolean) {
    if (single) {
      // Single-select: pick one value (replacing any prior) and close, or
      // clear on uncheck.
      onChange(checked ? [value] : []);
      if (checked) setOpen(false);
      return;
    }
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
        {label} <PixelIcon name="chevron-down" size={16} />
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
            <div
              key={opt.value}
              style={opt.depth ? { paddingLeft: opt.depth * 12 } : undefined}
            >
              <RetroCheckbox
                label={opt.label}
                checked={selected.includes(opt.value)}
                onChange={(e) => toggle(opt.value, e.target.checked)}
              />
            </div>
          ))}
        </div>
      </Popover>
    </>
  );
}
