interface ToggleOption {
  label: string;
  value: string;
}

interface ToggleGroupProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

export function ToggleGroup({
  options,
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: ToggleGroupProps) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex gap-xs flex-wrap">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-disabled={disabled}
            disabled={disabled}
            onClick={() => {
              if (!isActive && !disabled) onChange(option.value);
            }}
            className={`h-[44px] border-retro-thick border-retro-ink font-bold uppercase text-[14px] px-md cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-retro-amber ${
              disabled
                ? "bg-retro-gray cursor-not-allowed shadow-none text-retro-ink/50"
                : isActive
                  ? "bg-retro-amber shadow-retro-pressed text-retro-ink"
                  : "bg-retro-cream shadow-retro-raised text-retro-ink hover:bg-retro-amber/30"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
