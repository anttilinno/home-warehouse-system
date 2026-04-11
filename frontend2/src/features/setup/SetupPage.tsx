import { useLingui } from "@lingui/react/macro";
import { RetroPanel } from "@/components/retro";

export function SetupPage() {
  const { t } = useLingui();
  return (
    <div className="min-h-dvh bg-retro-charcoal flex items-center justify-center p-lg">
      <RetroPanel showHazardStripe className="max-w-[480px] w-full">
        <h1 className="text-[20px] font-bold uppercase text-retro-ink mb-md">
          {t`WORKSPACE SETUP`}
        </h1>
        <p className="font-mono text-[14px] text-retro-ink">
          {">"} {t`No workspace found. Please create a workspace to get started.`}
        </p>
      </RetroPanel>
    </div>
  );
}
