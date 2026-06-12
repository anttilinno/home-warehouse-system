import type { ReactNode } from "react";

const TITLEBAR_VARIANTS = {
  blue: "bg-titlebar-blue",
  pink: "bg-titlebar-pink",
  mint: "bg-titlebar-mint",
  butter: "bg-titlebar-butter",
  plain: "bg-bg-panel-2",
} as const;

export type TitlebarVariant = keyof typeof TITLEBAR_VARIANTS;

export interface WindowProps {
  /** Titlebar text. Omit for a chromeless panel (no titlebar rendered). */
  title?: ReactNode;
  /** Semantic color: blue default, mint positive, pink attention, butter warning. */
  titlebarVariant?: TitlebarVariant;
  /** Right-aligned slot inside the titlebar (e.g. meta text, buttons). */
  actions?: ReactNode;
  className?: string;
  /** Set to "" for flush content like tables. */
  bodyClassName?: string;
  children: ReactNode;
}

function CornerBox() {
  return (
    <span
      aria-hidden="true"
      className="h-[14px] w-[14px] flex-none border-2 border-border-ink bg-bg-panel"
    />
  );
}

// The chrome workhorse: 2px ink border, raised bevel, hard sand shadow,
// pinstriped pastel titlebar with a decorative close box (System 7 style).
export function Window({
  title,
  titlebarVariant = "blue",
  actions,
  className = "",
  bodyClassName = "p-sp-4",
  children,
}: WindowProps) {
  return (
    <section
      className={`border-2 border-border-ink bg-bg-panel bevel-raised ${className}`}
    >
      {title !== undefined && (
        <header
          className={`flex select-none items-center gap-sp-3 border-b-2 border-border-ink px-sp-3 py-[6px] pinstripes ${TITLEBAR_VARIANTS[titlebarVariant]}`}
        >
          <CornerBox />
          <h2 className="flex-1 truncate text-center font-display text-[16px] uppercase tracking-[0.02em]">
            {title}
          </h2>
          {actions ?? <CornerBox />}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
