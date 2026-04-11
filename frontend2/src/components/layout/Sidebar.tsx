import { NavLink } from "react-router";
import { useLingui } from "@lingui/react/macro";

interface SidebarProps {
  className?: string;
  onNavClick?: () => void;
}

const navItemBase =
  "w-full text-left px-md py-sm font-bold uppercase text-[14px] border-retro-thick border-retro-ink cursor-pointer outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber";
const navItemDefault =
  "bg-retro-cream text-retro-ink shadow-retro-raised hover:bg-retro-amber";
const navItemActive =
  "bg-retro-amber text-retro-ink shadow-retro-pressed";

export function Sidebar({ className, onNavClick }: SidebarProps) {
  const { t } = useLingui();

  return (
    <nav
      aria-label="Main navigation"
      className={`flex flex-col gap-sm ${className || ""}`}
    >
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `${navItemBase} ${isActive ? navItemActive : navItemDefault}`
        }
        onClick={onNavClick}
      >
        {t`DASHBOARD`}
      </NavLink>
      <NavLink
        to="/settings"
        className={({ isActive }) =>
          `${navItemBase} ${isActive ? navItemActive : navItemDefault}`
        }
        onClick={onNavClick}
      >
        {t`SETTINGS`}
      </NavLink>
    </nav>
  );
}
