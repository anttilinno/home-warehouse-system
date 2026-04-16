import {
  forwardRef,
  useRef,
  type Ref,
  type ChangeEvent,
} from "react";
import { useLingui } from "@lingui/react/macro";
import { RetroButton } from "./RetroButton";

interface RetroFileInputProps {
  accept?: string;
  multiple?: boolean;
  maxSizeBytes?: number;
  value?: File[];
  onChange?: (files: File[]) => void;
  error?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp";
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    refs.forEach((r) => {
      if (!r) return;
      if (typeof r === "function") r(node);
      else (r as { current: T | null }).current = node;
    });
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const RetroFileInput = forwardRef<HTMLInputElement, RetroFileInputProps>(
  (
    {
      accept = DEFAULT_ACCEPT,
      multiple = true,
      maxSizeBytes = DEFAULT_MAX_SIZE,
      value,
      onChange,
      error,
      id,
      disabled,
      className,
    },
    ref
  ) => {
    const { t } = useLingui();
    const inputRef = useRef<HTMLInputElement | null>(null);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.currentTarget.files ?? []).filter(
        (f) => f.size <= maxSizeBytes
      );
      e.currentTarget.value = "";
      onChange?.(list);
    };

    const handleRemove = (idx: number) => {
      if (!value) return;
      onChange?.(value.filter((_, i) => i !== idx));
    };

    return (
      <div className={className}>
        <input
          ref={mergeRefs(inputRef, ref)}
          type="file"
          accept={accept}
          multiple={multiple}
          id={id}
          disabled={disabled}
          className="sr-only"
          onChange={handleChange}
        />
        <RetroButton
          variant="neutral"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          {t`CHOOSE FILES`}
        </RetroButton>

        {value && value.length > 0 && (
          <ul className="flex flex-col gap-xs mt-sm">
            {value.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center justify-between gap-sm border-retro-thick border-retro-ink bg-retro-cream p-xs"
              >
                <span className="font-mono text-[14px] truncate">
                  {`${file.name} · ${formatSize(file.size)}`}
                </span>
                <button
                  type="button"
                  aria-label={t`Remove ${file.name}`}
                  onClick={() => handleRemove(i)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-retro-red hover:brightness-110 font-bold"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p className="text-retro-red text-[12px] mt-xs">{error}</p>
        ) : (
          <p className="text-[14px] text-retro-charcoal/70 mt-xs">
            {t`JPEG, PNG, or WebP up to 10 MB each.`}
          </p>
        )}
      </div>
    );
  }
);

RetroFileInput.displayName = "RetroFileInput";

export { RetroFileInput };
export type { RetroFileInputProps };
