import { useLingui } from "@lingui/react/macro";
import { RetroPanel } from "@/components/retro";
import { useAuth } from "@/features/auth/AuthContext";
import { SettingsRow } from "./SettingsRow";

export function SettingsPage() {
  const { t } = useLingui();
  const { user } = useAuth();

  const themePreview = user?.theme
    ? user.theme.charAt(0).toUpperCase() + user.theme.slice(1)
    : undefined;
  const languagePreview = user?.language
    ? user.language.toUpperCase()
    : undefined;
  const formatsPreview = user?.date_format ?? undefined;
  const notificationsPreview =
    user?.notification_preferences?.enabled ? t`ON` : t`OFF`;

  return (
    <div className="max-w-[600px] mx-auto p-lg flex flex-col gap-xl">
      <RetroPanel showHazardStripe title={t`ACCOUNT`}>
        <div className="flex flex-col gap-sm">
          <SettingsRow
            to="/settings/profile"
            label={t`PROFILE`}
            preview={user?.full_name ?? undefined}
          />
          <SettingsRow to="/settings/security" label={t`SECURITY`} />
        </div>
      </RetroPanel>

      <RetroPanel showHazardStripe title={t`PREFERENCES`}>
        <div className="flex flex-col gap-sm">
          <SettingsRow
            to="/settings/appearance"
            label={t`APPEARANCE`}
            preview={themePreview}
          />
          <SettingsRow
            to="/settings/language"
            label={t`LANGUAGE`}
            preview={languagePreview}
          />
          <SettingsRow
            to="/settings/formats"
            label={t`REGIONAL FORMATS`}
            preview={formatsPreview}
          />
          <SettingsRow
            to="/settings/notifications"
            label={t`NOTIFICATIONS`}
            preview={notificationsPreview}
          />
        </div>
      </RetroPanel>

      <RetroPanel showHazardStripe title={t`DATA`}>
        <div className="flex flex-col gap-sm">
          <SettingsRow to="/settings/data" label={t`IMPORT / EXPORT`} />
        </div>
      </RetroPanel>
    </div>
  );
}
