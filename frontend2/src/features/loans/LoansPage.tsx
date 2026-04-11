import { useLingui } from "@lingui/react/macro";
import { RetroPanel } from "@/components/retro";

export function LoansPage() {
  const { t } = useLingui();
  return (
    <div className="max-w-[480px] mx-auto">
      <RetroPanel showHazardStripe title={t`LOANS`}>
        <p className="font-mono text-[14px] text-retro-ink">
          {">"} {t`PAGE UNDER CONSTRUCTION`}
        </p>
      </RetroPanel>
    </div>
  );
}
