import { useLingui } from "@lingui/react/macro";
import { RetroTabs } from "@/components/retro";
import { useHashTab } from "./hooks/useHashTab";
import { CategoriesTab } from "./tabs/CategoriesTab";
import { LocationsTab } from "./tabs/LocationsTab";
import { ContainersTab } from "./tabs/ContainersTab";

const TAB_KEYS = ["categories", "locations", "containers"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default function TaxonomyPage() {
  const { t } = useLingui();
  const [tab, setTab] = useHashTab<TabKey>("categories", TAB_KEYS);

  return (
    <div className="flex flex-col gap-lg p-lg">
      <h1 className="text-[20px] font-semibold uppercase tracking-wider text-retro-ink">
        {t`TAXONOMY`}
      </h1>
      <RetroTabs
        tabs={[
          { key: "categories", label: t`CATEGORIES` },
          { key: "locations", label: t`LOCATIONS` },
          { key: "containers", label: t`CONTAINERS` },
        ]}
        activeTab={tab}
        onTabChange={(k) => setTab(k as TabKey)}
      />
      <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "categories" && <CategoriesTab />}
        {tab === "locations" && <LocationsTab />}
        {tab === "containers" && <ContainersTab />}
      </div>
    </div>
  );
}
