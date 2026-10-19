import { Link, useLocation } from "react-router";
import { Trans } from "@lingui/react/macro";
import { PixelIcon, type PixelIconName } from "@/components/retro";

// TabBar — the <768px primary navigation. Replaces the hamburger drawer + FAB
// pair: the four phone jobs (home, find item, scan, loans) are one tap away,
// and MORE opens the full Navigator drawer for everything else.

export interface TabBarProps {
  /** Open the Navigator drawer (the MORE tab). */
  onOpenMore: () => void;
}

const TAB =
  "flex flex-1 flex-col items-center justify-center gap-[2px] py-sp-1 text-10 font-bold uppercase tracking-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:-outline-offset-2";
const TAB_ACTIVE = `${TAB} bg-selection-fill text-fg-ink`;
const TAB_IDLE = `${TAB} text-fg-muted`;

type TabKey = "home" | "items" | "scan" | "loans" | "more";

// Which tab owns the current route. Stock and Expiring are sibling tabs of
// Items (InventoryScopeTabs), and everything reached through the drawer
// belongs to MORE — so some tab is always lit and the user knows where they
// are.
function currentTab(pathname: string): TabKey {
  const under = (base: string) =>
    pathname === base || pathname.startsWith(`${base}/`);
  if (pathname === "/") return "home";
  if (under("/items") || under("/inventory")) return "items";
  if (under("/scan")) return "scan";
  if (under("/loans")) return "loans";
  return "more";
}

function Tab({
  to,
  icon,
  label,
  active,
}: Readonly<{
  to: string;
  icon: PixelIconName;
  label: React.ReactNode;
  active: boolean;
}>) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={active ? TAB_ACTIVE : TAB_IDLE}
    >
      <PixelIcon name={icon} size={18} />
      <span>{label}</span>
    </Link>
  );
}

export function TabBar({ onOpenMore }: Readonly<TabBarProps>) {
  const tab = currentTab(useLocation().pathname);
  return (
    <nav
      aria-label="Primary (mobile)"
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(56px+env(safe-area-inset-bottom))] border-t-2 border-border-ink bg-bg-panel pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <Tab
        active={tab === "home"}
        to="/"
        icon="app-windows"
        label={<Trans>Home</Trans>}
      />
      <Tab
        active={tab === "items"}
        to="/items"
        icon="archive"
        label={<Trans>Items</Trans>}
      />
      <Tab
        active={tab === "scan"}
        to="/scan"
        icon="camera"
        label={<Trans>Scan</Trans>}
      />
      <Tab
        active={tab === "loans"}
        to="/loans"
        icon="download"
        label={<Trans>Loans</Trans>}
      />
      <button
        type="button"
        onClick={onOpenMore}
        className={tab === "more" ? TAB_ACTIVE : TAB_IDLE}
      >
        <PixelIcon name="menu" size={18} />
        <span>
          <Trans>More</Trans>
        </span>
      </button>
    </nav>
  );
}
