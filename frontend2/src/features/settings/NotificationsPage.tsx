import { useState } from "react";
import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { RetroPanel, RetroButton } from "@/components/retro";
import { HazardStripe } from "@/components/retro/HazardStripe";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro/RetroToast";
import { patch } from "@/lib/api";
import type { User, NotificationPreferences } from "@/lib/types";

interface OnOffToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}

function OnOffToggle({ value, onChange, disabled, label }: OnOffToggleProps) {
  const baseBtn =
    "h-[44px] px-md border-retro-thick border-retro-ink font-bold uppercase text-[14px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-retro-amber";
  const disabledStyle =
    "bg-retro-gray cursor-not-allowed shadow-none text-retro-ink/50 pointer-events-none";
  const inactiveStyle = "bg-retro-cream shadow-retro-raised text-retro-ink hover:brightness-95";
  const onActiveStyle = "bg-retro-green shadow-retro-pressed text-white";
  const offActiveStyle = "bg-retro-red shadow-retro-pressed text-white";

  return (
    <div role="group" aria-label={label} className="flex gap-xs">
      <button
        type="button"
        aria-pressed={value === true}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => !disabled && onChange(true)}
        className={`${baseBtn} ${disabled ? disabledStyle : value === true ? onActiveStyle : inactiveStyle}`}
      >
        ON
      </button>
      <button
        type="button"
        aria-pressed={value === false}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => !disabled && onChange(false)}
        className={`${baseBtn} ${disabled ? disabledStyle : value === false ? offActiveStyle : inactiveStyle}`}
      >
        OFF
      </button>
    </div>
  );
}

export function NotificationsPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();

  const initialPrefs = user?.notification_preferences ?? { enabled: false };
  const [masterEnabled, setMasterEnabled] = useState(initialPrefs.enabled ?? false);
  const [categoryStates, setCategoryStates] = useState({
    loans: initialPrefs.loans ?? false,
    inventory: initialPrefs.inventory ?? false,
    workspace: initialPrefs.workspace ?? false,
    system: initialPrefs.system ?? false,
  });

  async function savePreferences(
    master: boolean,
    categories: typeof categoryStates
  ) {
    const prefs: NotificationPreferences = {
      enabled: master,
      loans: categories.loans,
      inventory: categories.inventory,
      workspace: categories.workspace,
      system: categories.system,
    };
    try {
      await patch<User>("/users/me/preferences", { notification_preferences: prefs });
      await refreshUser();
      addToast(t`CHANGES SAVED`, "success");
    } catch {
      addToast(t`Failed to save changes. Check your connection and try again.`, "error");
    }
  }

  async function handleMasterChange(value: boolean) {
    setMasterEnabled(value);
    await savePreferences(value, categoryStates);
  }

  async function handleCategoryChange(key: keyof typeof categoryStates, value: boolean) {
    const next = { ...categoryStates, [key]: value };
    setCategoryStates(next);
    await savePreferences(masterEnabled, next);
  }

  const categories: { key: keyof typeof categoryStates; label: string }[] = [
    { key: "loans", label: t`LOANS` },
    { key: "inventory", label: t`INVENTORY` },
    { key: "workspace", label: t`WORKSPACE` },
    { key: "system", label: t`SYSTEM` },
  ];

  return (
    <div className="max-w-[600px] mx-auto p-lg flex flex-col gap-md">
      <RetroButton variant="neutral" onClick={() => navigate("/settings")}>
        {t`BACK`}
      </RetroButton>
      <RetroPanel showHazardStripe title={t`NOTIFICATIONS`}>
        <div className="flex flex-col gap-md">
          {/* Master toggle */}
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase text-[14px] text-retro-ink">
              {t`NOTIFICATIONS ENABLED`}
            </span>
            <OnOffToggle
              value={masterEnabled}
              onChange={handleMasterChange}
              label={t`Notifications enabled`}
            />
          </div>

          <HazardStripe className="my-md" />

          {/* Category toggles */}
          <div className="flex flex-col gap-sm">
            {categories.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-sm">
                <span className="font-bold uppercase text-[14px] text-retro-ink">
                  {label}
                </span>
                <OnOffToggle
                  value={categoryStates[key]}
                  onChange={(value) => handleCategoryChange(key, value)}
                  disabled={!masterEnabled}
                  label={label}
                />
              </div>
            ))}
          </div>
        </div>
      </RetroPanel>
    </div>
  );
}
