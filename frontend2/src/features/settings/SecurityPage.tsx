import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { RetroPanel, RetroButton } from "@/components/retro";

export function SecurityPage() {
  const { t } = useLingui();
  const navigate = useNavigate();

  return (
    <div className="max-w-[600px] mx-auto p-lg flex flex-col gap-md">
      <RetroButton variant="neutral" onClick={() => navigate("/settings")}>
        {t`BACK`}
      </RetroButton>
      <RetroPanel showHazardStripe title={t`SECURITY`}>
        {/* TODO: Security settings UI */}
        <p className="font-mono text-[14px] text-retro-ink">
          {">"} {t`SECURITY SETTINGS COMING SOON`}
        </p>
      </RetroPanel>
    </div>
  );
}
