import { useCallback, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { Window, RetroTabs } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { CategoriesTab } from "./components/CategoriesTab";
import { LocationsTab } from "./components/LocationsTab";
import { ContainersTab } from "./components/ContainersTab";
import { LabelsTab } from "./components/LabelsTab";

// Phase 10 Plan 02 — the /taxonomy page shell (TAX-01). MIRRORS LoansListPage:
// one mint Window, RetroTabs with the active tab in `?tab=` (the
// setSearchParams(prev=>…) round-trip), default + unknown → categories. The page
// imports ALL FOUR tab components by their stable paths; CategoriesTab is fully
// implemented in this plan, the other three are W3/W4 STUBS filled IN-PLACE
// (the page never re-renders structurally when the stubs are filled — no
// same-wave plan re-edits this file).
//
// RetroTabs owns its panel padding (p-sp-4) — do NOT double-pad inside panels.

const TAB_IDS = ["categories", "locations", "containers", "labels"] as const;
type TaxTab = (typeof TAB_IDS)[number];

const TABS: { id: TaxTab; label: ReactNode }[] = [
  { id: "categories", label: <Trans>CATEGORIES</Trans> },
  { id: "locations", label: <Trans>LOCATIONS</Trans> },
  { id: "containers", label: <Trans>CONTAINERS</Trans> },
  { id: "labels", label: <Trans>LABELS</Trans> },
];

function isTaxTab(value: string | null): value is TaxTab {
  return value !== null && (TAB_IDS as readonly string[]).includes(value);
}

export function TaxonomyPage() {
  const { t } = useLingui();
  const [params, setSearchParams] = useSearchParams();
  const { currentWorkspaceId: wsId, workspaces } = useWorkspace();

  const raw = params.get("tab");
  const tab: TaxTab = isTaxTab(raw) ? raw : "categories";

  const workspaceName =
    workspaces?.find((w) => w.id === wsId)?.name ?? t`Workspace`;

  const titleFor = (id: TaxTab): string => {
    switch (id) {
      case "categories":
        return t`CATEGORIES — ${workspaceName}`;
      case "locations":
        return t`LOCATIONS — ${workspaceName}`;
      case "containers":
        return t`CONTAINERS — ${workspaceName}`;
      case "labels":
        return t`LABELS — ${workspaceName}`;
    }
  };

  const setTab = useCallback(
    (id: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", id);
        return next;
      });
    },
    [setSearchParams],
  );

  // Each panel mounts only when its tab is active (RetroTabs renders the active
  // panel). The stubs render their pending testids; CategoriesTab is live.
  const panelFor = (id: TaxTab): ReactNode => {
    switch (id) {
      case "categories":
        return <CategoriesTab />;
      case "locations":
        return <LocationsTab />;
      case "containers":
        return <ContainersTab />;
      case "labels":
        return <LabelsTab />;
    }
  };

  const tabs = TABS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    content: panelFor(definition.id),
  }));

  return (
    <div className="mx-auto min-w-0 max-w-[1280px]">
      <Window title={titleFor(tab)} titlebarVariant="mint">
        {/* Tabs hidden on mobile — categories/locations/containers each have a
            Sidebar (mobile menu) entry, and the Window title names the active
            view, so the in-page strip is redundant and only forces a scroll. */}
        <RetroTabs
          tabs={tabs}
          value={tab}
          onChange={setTab}
          hideTablistBelowMd
        />
      </Window>
    </div>
  );
}
