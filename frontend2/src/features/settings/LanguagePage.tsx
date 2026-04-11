import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { RetroPanel, RetroButton } from "@/components/retro";
import { ToggleGroup } from "./ToggleGroup";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro/RetroToast";
import { patch } from "@/lib/api";
import { loadCatalog } from "@/lib/i18n";
import type { User } from "@/lib/types";

export function LanguagePage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();

  async function handleLanguageChange(language: string) {
    try {
      await patch<User>("/users/me/preferences", { language });
      await refreshUser();
      await loadCatalog(language); // Live switching — no reload needed
      addToast(t`CHANGES SAVED`, "success");
    } catch {
      addToast(
        t`Failed to save changes. Check your connection and try again.`,
        "error"
      );
    }
  }

  const languageOptions = [
    { label: t`ENGLISH`, value: "en" },
    { label: t`EESTI`, value: "et" },
  ];

  return (
    <div className="max-w-[600px] mx-auto p-lg flex flex-col gap-md">
      <RetroButton variant="neutral" onClick={() => navigate("/settings")}>
        {t`BACK`}
      </RetroButton>
      <RetroPanel showHazardStripe title={t`LANGUAGE`}>
        <div className="flex flex-col gap-md">
          <h3 className="font-bold uppercase text-[14px] text-retro-ink mb-md">
            {t`LANGUAGE`}
          </h3>
          <ToggleGroup
            options={languageOptions}
            value={user?.language ?? "en"}
            onChange={handleLanguageChange}
            aria-label={t`Language`}
          />
        </div>
      </RetroPanel>
    </div>
  );
}
