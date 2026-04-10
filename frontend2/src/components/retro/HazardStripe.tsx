interface HazardStripeProps {
  height?: number;
  className?: string;
}

function HazardStripe({ height = 8, className }: HazardStripeProps) {
  return (
    <div
      className={`bg-hazard-stripe w-full ${className || ""}`}
      style={{ height }}
    />
  );
}

export { HazardStripe };
export type { HazardStripeProps };
