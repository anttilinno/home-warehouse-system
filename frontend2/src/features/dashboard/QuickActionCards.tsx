import { Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { RetroCard, RetroButton } from "@/components/retro";

const actions = [
  { labelKey: "ADD ITEM", to: "/items" },
  { labelKey: "SCAN BARCODE", to: "/scan" },
  { labelKey: "VIEW LOANS", to: "/loans" },
] as const;

export function QuickActionCards() {
  const { t } = useLingui();

  // Map label keys to translated strings
  const labels: Record<string, string> = {
    "ADD ITEM": t`ADD ITEM`,
    "SCAN BARCODE": t`SCAN BARCODE`,
    "VIEW LOANS": t`VIEW LOANS`,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
      {actions.map(({ labelKey, to }) => (
        <Link key={to} to={to} aria-label={labels[labelKey]} className="block">
          <RetroCard className="flex flex-col items-center gap-md">
            <span className="font-bold uppercase text-[14px] text-retro-ink text-center">
              {labels[labelKey]}
            </span>
            <RetroButton variant="primary" className="w-full" tabIndex={-1}>
              {labels[labelKey]}
            </RetroButton>
          </RetroCard>
        </Link>
      ))}
    </div>
  );
}
