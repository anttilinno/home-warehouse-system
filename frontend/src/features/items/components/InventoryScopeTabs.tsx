import { Trans } from "@lingui/react/macro";
import { NavLink } from "react-router";

// Link-tabs across the three stock scopes. The sidebar has no "Inventory"
// entry, so these are the only path to /inventory and /inventory/expiring.
// Class names mirror RetroTabs' folder tabs (TAB_BASE / TAB_ACTIVE / TAB_INACTIVE).
const TAB =
  "shrink-0 whitespace-nowrap cursor-pointer border-2 border-border-ink border-b-0 px-sp-3 py-[5px] font-body text-11 font-bold uppercase tracking-7 text-fg-ink no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2";

const SCOPES = [
  { to: "/items", label: <Trans>ITEMS</Trans>, end: true },
  { to: "/inventory", label: <Trans>STOCK</Trans>, end: true },
  { to: "/inventory/expiring", label: <Trans>EXPIRING</Trans>, end: false },
];

export function InventoryScopeTabs() {
  return (
    <nav
      aria-label="Inventory scope"
      className="mb-sp-3 flex min-w-0 items-end gap-sp-1 overflow-x-auto border-b-2 border-border-ink"
    >
      {SCOPES.map((s) => (
        <NavLink
          key={s.to}
          to={s.to}
          end={s.end}
          className={({ isActive }) =>
            `${TAB} ${isActive ? "bg-titlebar-blue bevel-raised-ink" : "bg-bg-panel-2"}`
          }
        >
          {s.label}
        </NavLink>
      ))}
    </nav>
  );
}
