import {
  forwardRef,
  useCallback,
  type TextareaHTMLAttributes,
} from "react";
import type { InputEvent as ReactInputEvent } from "react";

interface RetroTextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

const MAX_ROWS = 8;
const LINE_HEIGHT = 24; // 16px * 1.5

const RetroTextarea = forwardRef<HTMLTextAreaElement, RetroTextareaProps>(
  ({ error, className, onInput, ...rest }, ref) => {
    const handleInput = useCallback(
      (e: ReactInputEvent<HTMLTextAreaElement>) => {
        const el = e.currentTarget;
        el.style.height = "auto";
        const next = Math.min(
          el.scrollHeight || LINE_HEIGHT,
          LINE_HEIGHT * MAX_ROWS
        );
        el.style.height = `${next}px`;
        onInput?.(e);
      },
      [onInput]
    );

    return (
      <div>
        <textarea
          ref={ref}
          onInput={handleInput}
          className={`w-full min-h-[88px] border-retro-thick ${
            error ? "border-retro-red" : "border-retro-ink"
          } bg-retro-cream font-mono text-[14px] text-retro-ink placeholder:text-retro-gray p-sm outline-2 outline-offset-2 outline-transparent focus:outline-retro-amber disabled:bg-retro-gray disabled:cursor-not-allowed resize-none ${
            className || ""
          }`}
          {...rest}
        />
        {error && (
          <p className="text-retro-red text-[12px] mt-xs">{error}</p>
        )}
      </div>
    );
  }
);

RetroTextarea.displayName = "RetroTextarea";

export { RetroTextarea };
export type { RetroTextareaProps };
