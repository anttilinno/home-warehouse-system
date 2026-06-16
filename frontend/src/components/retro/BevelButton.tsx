import type { ComponentPropsWithRef } from "react";

const BUTTON_VARIANTS = {
  neutral: "bg-bg-panel text-fg-ink",
  primary: "bg-titlebar-blue text-fg-ink",
  mint: "bg-titlebar-mint text-fg-ink",
  danger: "bg-danger-bg text-danger",
} as const;

export type BevelButtonVariant = keyof typeof BUTTON_VARIANTS;

export interface BevelButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: BevelButtonVariant;
}

// Raised bevel button; :active inverts the bevel and nudges 1px — the press.
export function BevelButton({
  variant = "neutral",
  className = "",
  type = "button",
  ...props
}: Readonly<BevelButtonProps>) {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center gap-sp-2 border-2 border-border-ink px-[14px] py-[6px] font-body text-13 font-semibold uppercase tracking-4 bevel-raised-ink hover:brightness-103 active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
