import { NavLink } from "react-router";
import { useLingui } from "@lingui/react/macro";

const navItemBase =
  "block w-full text-left font-bold uppercase text-[14px] border-retro-thick border-retro-ink px-md py-sm";
const navItemActive =
  "bg-retro-amber text-retro-ink shadow-retro-pressed";
const navItemDefault =
  "bg-retro-cream text-retro-ink shadow-retro-raised hover:shadow-retro-pressed";

export function Sidebar() {
  const { t } = useLingui();

  const items = [
    { to: "/", label: t`DASHBOARD`, end: true },
    { to: "/items", label: t`ITEMS`, end: false },
    { to: "/loans", label: t`LOANS`, end: false },
    { to: "/settings", label: t`SETTINGS`, end: false },
  ];

  return (
    <nav className="flex flex-col gap-sm">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `${navItemBase} ${isActive ? navItemActive : navItemDefault}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
