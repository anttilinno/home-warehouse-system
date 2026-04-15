import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
  FloatingPortal,
} from "@floating-ui/react";
import { useLingui } from "@lingui/react/macro";
import type { RetroOption } from "./RetroSelect";

interface RetroComboboxProps {
  options: RetroOption[];
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  id?: string;
  name?: string;
  emptyMessage?: string;
  loadingMessage?: string;
}

const DEBOUNCE_MS = 250;

const RetroCombobox = forwardRef<HTMLInputElement, RetroComboboxProps>(
  (
    {
      options,
      value,
      onChange,
      onBlur,
      onSearch,
      placeholder,
      loading,
      disabled,
      error,
      id,
      name,
      emptyMessage,
      loadingMessage,
    },
    ref
  ) => {
    const { t } = useLingui();
    const autoListId = useId();
    const listboxId = id ? `${id}-listbox` : `cb-${autoListId}`;
    const optPrefix = id ? `${id}-opt` : `cb-${autoListId}-opt`;

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const listRef = useRef<Array<HTMLElement | null>>([]);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

    const { refs, floatingStyles, context } = useFloating({
      open,
      onOpenChange: setOpen,
      whileElementsMounted: autoUpdate,
      middleware: [
        offset(4),
        flip({ padding: 8 }),
        shift({ padding: 8 }),
        size({
          apply({ rects, elements, availableHeight }) {
            Object.assign(elements.floating.style, {
              width: `${rects.reference.width}px`,
              maxHeight: `${Math.min(availableHeight, 320)}px`,
            });
          },
        }),
      ],
    });

    const dismiss = useDismiss(context);
    const role = useRole(context, { role: "listbox" });
    const listNav = useListNavigation(context, {
      listRef,
      activeIndex,
      onNavigate: setActiveIndex,
      loop: true,
      virtual: true,
    });
    const { getReferenceProps, getFloatingProps, getItemProps } =
      useInteractions([dismiss, role, listNav]);

    // Debounced search
    useEffect(() => {
      if (!onSearch) return;
      const handle = setTimeout(() => onSearch(query), DEBOUNCE_MS);
      return () => clearTimeout(handle);
    }, [query, onSearch]);

    const handleSelect = (i: number) => {
      const opt = options[i];
      if (!opt || opt.disabled) return;
      onChange?.(opt.value);
      setOpen(false);
      setQuery(opt.label);
    };

    const inputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (
        open &&
        activeIndex !== null &&
        !loading &&
        options.length > 0 &&
        e.key === "Enter"
      ) {
        e.preventDefault();
        handleSelect(activeIndex);
      }
    };

    const activeId =
      activeIndex !== null ? `${optPrefix}-${activeIndex}` : undefined;

    const showEmpty = !loading && options.length === 0;

    return (
      <div className="relative">
        <div
          ref={refs.setReference}
          className={`w-full min-h-[44px] border-retro-thick ${error ? "border-retro-red" : "border-retro-ink"} bg-retro-cream flex items-center`}
        >
          <input
            ref={inputRef}
            id={id}
            name={name}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            placeholder={placeholder ?? t`Select option…`}
            disabled={disabled}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={onBlur}
            {...getReferenceProps({ onKeyDown: inputKeyDown })}
            className="w-full min-h-[44px] px-sm bg-transparent font-sans text-[16px] text-retro-ink outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber disabled:bg-retro-gray disabled:cursor-not-allowed"
          />
          {value && !query && (
            <span className="sr-only" aria-live="polite">
              {options.find((o) => o.value === value)?.label}
            </span>
          )}
        </div>
        {open && (
          <FloatingPortal>
            <ul
              id={listboxId}
              // eslint-disable-next-line react-hooks/refs -- setter callback, not ref read
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className="bg-retro-cream border-retro-thick border-retro-ink shadow-retro-raised z-50 overflow-y-auto py-xs"
            >
              {loading && (
                <li
                  role="status"
                  className="min-h-[44px] px-sm flex items-center font-sans text-[16px] text-retro-charcoal"
                >
                  {loadingMessage ?? t`Loading…`}
                </li>
              )}
              {showEmpty && (
                <li className="min-h-[44px] px-sm flex items-center font-sans text-[16px] text-retro-charcoal">
                  {emptyMessage ?? t`No matches found.`}
                </li>
              )}
              {!loading &&
                options.map((opt, i) => (
                  <li
                    key={opt.value}
                    id={`${optPrefix}-${i}`}
                    ref={(node) => {
                      listRef.current[i] = node;
                    }}
                    role="option"
                    aria-selected={opt.value === value}
                    aria-disabled={opt.disabled}
                    {...getItemProps({
                      onClick: () => handleSelect(i),
                    })}
                    className={`min-h-[44px] px-sm flex items-center gap-sm font-sans text-[16px] text-retro-ink cursor-pointer ${i === activeIndex ? "bg-retro-amber" : ""} ${opt.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {opt.label}
                  </li>
                ))}
            </ul>
          </FloatingPortal>
        )}
        {error && (
          <p className="text-retro-red text-[12px] mt-xs">{error}</p>
        )}
      </div>
    );
  }
);

RetroCombobox.displayName = "RetroCombobox";

export { RetroCombobox };
export type { RetroComboboxProps };
