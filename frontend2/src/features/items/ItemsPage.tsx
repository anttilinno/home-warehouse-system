import { useLingui } from "@lingui/react/macro";
import { RetroPanel } from "@/components/retro";

export function ItemsPage() {
  const { t } = useLingui();
  return (
    <div className="max-w-[480px] mx-auto">
      <RetroPanel showHazardStripe title={t`ITEMS`}>
        <p className="font-mono text-[14px] text-retro-ink">
          {">"} {t`PAGE UNDER CONSTRUCTION`}
        </p>
      </RetroPanel>
    </div>
  );
}
