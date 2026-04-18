interface HazardStripeProps {
  height?: number;
  className?: string;
  variant?: "yellow" | "red";
}

function HazardStripe({
  height = 8,
  className,
  variant = "yellow",
}: HazardStripeProps) {
  const variantClass =
    variant === "red" ? "bg-retro-red" : "bg-hazard-stripe";
  return (
    <div
      data-variant={variant}
      className={`${variantClass} w-full ${className || ""}`}
      style={{ height }}
    />
  );
}

export { HazardStripe };
export type { HazardStripeProps };
