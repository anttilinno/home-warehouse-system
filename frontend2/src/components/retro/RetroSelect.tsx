import {
  forwardRef,
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
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
  FloatingFocusManager,
  FloatingPortal,
} from "@floating-ui/react";
import { useLingui } from "@lingui/react/macro";

const ChevronDown = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
  >
    <path d="M5 7l5 5 5-5" strokeLinecap="square" />
  </svg>
);

const Check = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
  >
    <path d="M3 8l3 3 7-7" strokeLinecap="square" />
  </svg>
);

interface RetroOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface RetroSelectProps {
  options: RetroOption[];
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  id?: string;
  name?: string;
}

const RetroSelect = forwardRef<HTMLButtonElement, RetroSelectProps>(
  (
    { options, value, onChange, onBlur, placeholder, disabled, error, id, name },
    ref
  ) => {
    const { t } = useLingui();
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const listRef = useRef<Array<HTMLElement | null>>([]);
    const triggerRef = useRef<HTMLButtonElement | null>(null);

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

    const click = useClick(context, { enabled: !disabled });
    const dismiss = useDismiss(context);
    const role = useRole(context, { role: "listbox" });
    const listNav = useListNavigation(context, {
      listRef,
      activeIndex,
      onNavigate: setActiveIndex,
      loop: true,
      virtual: false,
    });
    const { getReferenceProps, getFloatingProps, getItemProps } =
      useInteractions([click, dismiss, role, listNav]);

    const selected = options.find((o) => o.value === value);

    useImperativeHandle(
      ref,
      () => triggerRef.current as HTMLButtonElement,
      []
    );

    const handleSelect = (i: number) => {
      const opt = options[i];
      if (!opt || opt.disabled) return;
      onChange?.(opt.value);
      setOpen(false);
    };

    const triggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (
        open &&
        activeIndex !== null &&
        (e.key === "Enter" || e.key === " ")
      ) {
        e.preventDefault();
        handleSelect(activeIndex);
      }
    };

    return (
      <div className="relative">
        <button
          type="button"
          id={id}
          name={name}
          ref={(node) => {
            triggerRef.current = node;
            refs.setReference(node);
          }}
          disabled={disabled}
          onBlur={onBlur}
          aria-haspopup="listbox"
          aria-expanded={open}
          {...getReferenceProps({ onKeyDown: triggerKeyDown })}
          className={`w-full min-h-[44px] px-sm pr-[40px] border-retro-thick ${error ? "border-retro-red" : "border-retro-ink"} bg-retro-cream font-sans text-[16px] text-retro-ink text-left outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber disabled:bg-retro-gray disabled:cursor-not-allowed relative`}
        >
          {selected ? selected.label : placeholder ?? t`Select option…`}
          <ChevronDown className="absolute right-sm top-1/2 -translate-y-1/2 w-[20px] h-[20px]" />
        </button>
        {open && (
          <FloatingPortal>
            <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
              <ul
                // eslint-disable-next-line react-hooks/refs -- setter callback, not ref read
                ref={refs.setFloating}
                style={floatingStyles}
                {...getFloatingProps()}
                className="bg-retro-cream border-retro-thick border-retro-ink shadow-retro-raised z-50 overflow-y-auto py-xs"
              >
                {options.map((opt, i) => (
                  <li
                    key={opt.value}
                    ref={(node) => {
                      listRef.current[i] = node;
                    }}
                    role="option"
                    aria-selected={opt.value === value}
                    aria-disabled={opt.disabled}
                    tabIndex={i === activeIndex ? 0 : -1}
                    {...getItemProps({
                      onClick: () => handleSelect(i),
                      onKeyDown: (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelect(i);
                        }
                      },
                    })}
                    className={`min-h-[44px] px-sm flex items-center gap-sm font-sans text-[16px] text-retro-ink cursor-pointer ${i === activeIndex ? "bg-retro-amber" : ""} ${opt.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Check className={`w-[16px] h-[16px] ${opt.value === value ? "" : "invisible"}`} />
                    {opt.label}
                  </li>
                ))}
              </ul>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
        {error && (
          <p className="text-retro-red text-[12px] mt-xs">{error}</p>
        )}
      </div>
    );
  }
);

RetroSelect.displayName = "RetroSelect";

export { RetroSelect };
export type { RetroSelectProps, RetroOption };
