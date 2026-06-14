import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Trans } from "@lingui/react/macro";
import { Popover } from "../overlay/Popover";

export interface RetroComboboxOption {
  value: string;
  label: string;
}

export interface RetroComboboxProps {
  label: ReactNode;
  options: RetroComboboxOption[];
  /** Controlled selected value (the option `value`). */
  value: string;
  onChange: (value: string) => void;
  error?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * A hand-rolled editable combobox (W3C APG list-autocomplete pattern). DOM focus
 * STAYS on the `<input role="combobox">` at all times; arrow keys move a VIRTUAL
 * highlight by setting `aria-activedescendant` to the active option's stable id
 * (Pitfall 2). The listbox renders through the Plan 04-01 `Popover`, so ESC
 * routes through the shared `useModalStack` arbiter — this component owns NO
 * document-level ESC listener. Enter/Tab commit the active option; the empty
 * filter shows a single muted `No matches.` row.
 */
export function RetroCombobox({
  label,
  options,
  value,
  onChange,
  error,
  placeholder,
  disabled = false,
}: RetroComboboxProps) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const errorId = `${baseId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? "",
    [options, value],
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // -1 = no active descendant yet; the first ArrowDown lands on option 0 (APG).
  const [activeIndex, setActiveIndex] = useState(-1);
  // `query` drives the display while typing; otherwise show the selected label.
  const [typing, setTyping] = useState(false);

  const display = typing ? query : selectedLabel;

  const filtered = useMemo(() => {
    if (!typing || query.trim() === "") return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, typing]);

  const optionId = (i: number) => `${baseId}-opt-${i}`;

  // Keep DOM focus on the input even though the Popover would otherwise move
  // focus into the floating panel — virtual focus (aria-activedescendant) only.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, filtered.length]);

  // Scroll the active option into view as the virtual highlight moves.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = document.getElementById(optionId(activeIndex));
    // scrollIntoView is unavailable under jsdom — guard so tests don't throw.
    el?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, open]);

  const openList = () => {
    if (disabled) return;
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setTyping(false);
    setQuery("");
    setActiveIndex(-1);
  };

  const commit = (index: number) => {
    const opt = filtered[index];
    if (!opt) return;
    onChange(opt.value);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) =>
          filtered.length ? (i + 1 + filtered.length) % filtered.length : -1,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) =>
          filtered.length
            ? (i <= 0 ? filtered.length : i) - 1
            : -1,
        );
        break;
      case "Enter":
        e.preventDefault();
        commit(activeIndex);
        break;
      case "Tab":
        if (filtered[activeIndex]) commit(activeIndex);
        break;
      // ESC is intentionally NOT handled here — the Popover routes it through
      // useModalStack (single ESC authority, TUI-02 LOCKED).
      default:
        break;
    }
  };

  return (
    <div>
      <label
        htmlFor={baseId}
        className="mb-sp-1 block text-[12px] font-bold uppercase tracking-[0.08em] text-fg-muted"
      >
        {label}
      </label>
      <input
        ref={inputRef}
        id={baseId}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 && filtered.length
            ? optionId(activeIndex)
            : undefined
        }
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
        placeholder={placeholder}
        value={display}
        onChange={(e) => {
          setTyping(true);
          setQuery(e.target.value);
          setActiveIndex(0);
          if (!open) setOpen(true);
        }}
        onFocus={openList}
        onClick={openList}
        onKeyDown={onKeyDown}
        className={`w-full border-2 px-[10px] py-[7px] font-body text-[14px] text-fg-ink bevel-sunken focus:outline-3 focus:outline-offset-1 focus:outline-titlebar-blue disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-danger bg-danger-bg" : "border-border-ink bg-bg-panel"
        }`}
      />
      <Popover
        open={open}
        onClose={close}
        anchorRef={inputRef}
        role="listbox"
      >
        {/* The Popover panel carries role="listbox"; this inner list is a plain
            container so there is exactly one listbox in the tree. */}
        <ul
          id={listboxId}
          className="max-h-[240px] overflow-y-auto outline-none"
        >
          {filtered.length === 0 ? (
            <li className="px-sp-2 py-sp-2 text-[12px] text-fg-muted">
              <Trans>No matches.</Trans>
            </li>
          ) : (
            filtered.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIndex;
              return (
                <li
                  key={opt.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => {
                    // Prevent the input from losing focus before we commit.
                    e.preventDefault();
                    commit(i);
                  }}
                  className={`flex cursor-pointer items-center gap-sp-1 px-sp-2 py-[5px] text-[14px] text-fg-ink ${
                    isActive ? "bg-titlebar-blue" : ""
                  }`}
                >
                  <span aria-hidden="true" className="w-[12px] flex-none">
                    {isSelected ? "✓" : ""}
                  </span>
                  <span>{opt.label}</span>
                </li>
              );
            })
          )}
        </ul>
      </Popover>
      {error && (
        <p id={errorId} className="mt-sp-1 text-[12px] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
