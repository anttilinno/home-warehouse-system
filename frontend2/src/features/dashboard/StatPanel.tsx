import { RetroPanel } from "@/components/retro";

interface StatPanelProps {
  label: string;
  value: number | null;
  className?: string;
}

export function StatPanel({ label, value, className }: StatPanelProps) {
  return (
    <RetroPanel showHazardStripe className={className}>
      <div
        className="text-center py-md"
        aria-label={value !== null ? `${label}: ${value}` : label}
      >
        <div className="font-mono text-[48px] font-bold leading-none text-retro-ink">
          {value === null ? (
            <span className="text-retro-gray">---</span>
          ) : (
            value
          )}
        </div>
        <div className="font-mono text-[12px] font-bold uppercase text-retro-gray mt-xs tracking-widest">
          {label}
        </div>
      </div>
    </RetroPanel>
  );
}
