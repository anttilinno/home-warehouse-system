import { useLingui } from "@lingui/react/macro";
import { useAuth } from "@/features/auth/AuthContext";
import { RetroButton } from "@/components/retro";

interface TopBarProps {
  onMenuClick: () => void;
  drawerOpen: boolean;
}

export function TopBar({ onMenuClick, drawerOpen }: TopBarProps) {
  const { t } = useLingui();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 h-[48px] bg-retro-cream border-b-retro-thick border-retro-ink shadow-retro-raised z-30 flex items-center justify-between px-md">
      {/* Left section */}
      <div className="flex items-center gap-sm">
        <RetroButton
          variant="neutral"
          className="w-[44px] !px-0 md:hidden"
          onClick={onMenuClick}
          aria-label={drawerOpen ? t`Close navigation` : t`Open navigation`}
          aria-expanded={drawerOpen}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="4" y="4" width="16" height="2" />
            <rect x="4" y="11" width="16" height="2" />
            <rect x="4" y="18" width="16" height="2" />
          </svg>
        </RetroButton>
        <span className="text-[20px] font-bold uppercase text-retro-ink">
          HOME WAREHOUSE
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-md">
        {/* User info group */}
        <div className="flex items-center gap-sm">
          {/* Avatar */}
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.full_name}
              className="w-[32px] h-[32px] rounded-full object-cover border-retro-thick border-retro-ink"
            />
          ) : (
            <div className="w-[32px] h-[32px] rounded-full bg-retro-charcoal text-retro-cream flex items-center justify-center text-[14px] font-bold border-retro-thick border-retro-ink">
              {user?.full_name?.charAt(0).toUpperCase() ?? "?"}
            </div>
          )}
          {/* Name */}
          <span className="text-[14px] text-retro-ink hidden sm:inline">
            {user?.full_name}
          </span>
        </div>

        {/* Logout button */}
        <RetroButton variant="neutral" onClick={logout}>
          {t`LOGOUT`}
        </RetroButton>
      </div>
    </header>
  );
}
