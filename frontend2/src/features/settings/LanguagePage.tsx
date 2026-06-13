import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api/settings";
import { loadCatalog, type Locale } from "@/lib/i18n";
import type { User } from "@/lib/types";
import { RetroSelect, Window, retroToast } from "@/components/retro";

// Phase 12 Plan 04 — SETT-05. Interface language picker. The ONLY tricky bit is
// Pitfall 4 (render-loop guard): lingui activation (loadCatalog) must run in the
// mutation onSuccess EVENT HANDLER, never during render/effect — otherwise a
// re-render → activate → re-render storm. PATCH {language} persists FIRST; only
// once the server confirms do we activate the catalog locally. et/ru catalogs
// are Phase-15 stubs: untranslated msgids fall back to source (parity behavior).

const LANGUAGE_OPTIONS: { value: Locale; endonym: string }[] = [
  { value: "en", endonym: "English" },
  { value: "et", endonym: "Eesti" },
  { value: "ru", endonym: "Русский" },
];

export function LanguagePage() {
  const { t } = useLingui();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => settingsApi.getMe(),
  });

  const current = (me.data?.language as Locale | undefined) ?? "en";

  const mutation = useMutation({
    mutationFn: (language: Locale) =>
      settingsApi.updatePreferences({ language }),
    onSuccess: async (_user: User, language: Locale) => {
      // EVENT-HANDLER activation (Pitfall 4): only after the PATCH resolves, and
      // exactly once per change. loadCatalog failure is non-fatal — log + carry
      // on (mirrors main.tsx initial-activation behavior).
      try {
        await loadCatalog(language);
      } catch (err) {
        console.error("loadCatalog failed", err);
      }
      queryClient.invalidateQueries({ queryKey: ["me"] });
      retroToast.success(t`Language updated.`);
    },
  });

  return (
    <Window title={<Trans>Language</Trans>} bodyClassName="grid gap-sp-3 p-sp-4">
      <RetroSelect
        label={<Trans>Interface language</Trans>}
        value={current}
        disabled={me.isPending || mutation.isPending}
        onChange={(e) => mutation.mutate(e.target.value as Locale)}
      >
        {LANGUAGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.endonym}
          </option>
        ))}
      </RetroSelect>
      <p className="text-[14px] text-fg-muted">
        <Trans>Changes apply immediately.</Trans>
      </p>
    </Window>
  );
}
