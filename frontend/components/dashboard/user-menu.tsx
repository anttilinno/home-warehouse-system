"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Pencil,
  Calendar,
  Bell,
  BellOff,
  Settings,
  LogOut,
  Loader2,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/contexts/auth-context";
import { usePushNotifications } from "@/lib/hooks/use-push-notifications";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { ProfileEditSheet } from "./profile-edit-sheet";
import { toast } from "sonner";
import type { DateFormatOption } from "@/lib/hooks/use-date-format";

interface UserMenuProps {
  collapsed?: boolean;
}

const DATE_FORMAT_OPTIONS: {
  value: DateFormatOption;
  label: string;
  dateFns: string;
}[] = [
  { value: "MM/DD/YY", label: "MM/DD/YY", dateFns: "MM/dd/yy" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY", dateFns: "dd/MM/yyyy" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD", dateFns: "yyyy-MM-dd" },
];

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const t = useTranslations("dashboard.userMenu");
  const tDateFormat = useTranslations("settings.dateFormat");
  const router = useRouter();
  const { user, isLoading, logout, refreshUser } = useAuth();
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [isUpdatingDateFormat, setIsUpdatingDateFormat] = useState(false);

  // Push notifications
  const {
    isSupported: pushSupported,
    permission: pushPermission,
    isSubscribed: pushEnabled,
    isLoading: pushLoading,
    subscribe: pushSubscribe,
    unsubscribe: pushUnsubscribe,
  } = usePushNotifications();

  // Loading state
  if (isLoading) {
    return (
      <Button
        variant="ghost"
        className={cn(
          "relative h-auto p-2 rounded-lg",
          collapsed ? "w-10 justify-center" : "w-full justify-start gap-3"
        )}
        disabled
      >
        <Skeleton className="h-8 w-8 rounded-full" />
        {!collapsed && (
          <div className="flex flex-col gap-1 items-start">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2 w-24" />
          </div>
        )}
      </Button>
    );
  }

  // No user (shouldn't happen in dashboard, but handle gracefully)
  if (!user) {
    return null;
  }

  const initials = user.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const currentDateFormat = (user.date_format as DateFormatOption) || "YYYY-MM-DD";
  const exampleDate = new Date();

  const handleDateFormatChange = async (value: string) => {
    if (value === currentDateFormat) return;

    setIsUpdatingDateFormat(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        credentials: "include",
        body: JSON.stringify({ date_format: value }),
      });
      await refreshUser();
      toast.success(tDateFormat("saved"));
    } catch {
      toast.error(tDateFormat("saveError"));
    } finally {
      setIsUpdatingDateFormat(false);
    }
  };

  const handlePushToggle = async () => {
    if (pushEnabled) {
      const success = await pushUnsubscribe();
      if (!success) {
        toast.error(t("notificationsError"));
      }
    } else {
      const success = await pushSubscribe();
      if (!success) {
        toast.error(t("notificationsError"));
      }
    }
  };

  // Determine push notification state for display
  const canTogglePush = pushSupported && pushPermission !== "denied";
  const pushStatusIcon = pushEnabled ? (
    <Bell className="mr-2 h-4 w-4" />
  ) : (
    <BellOff className="mr-2 h-4 w-4" />
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "relative h-auto p-2 rounded-lg",
              collapsed ? "w-10 justify-center" : "w-full justify-start gap-3"
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user.avatar_url || undefined}
                alt={user.full_name}
              />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium truncate max-w-[140px]">
                  {user.full_name}
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                  {user.email}
                </span>
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56"
          align={collapsed ? "center" : "end"}
          side={collapsed ? "right" : "top"}
          forceMount
        >
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.full_name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Edit Profile */}
          <DropdownMenuItem onClick={() => setProfileSheetOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {t("editProfile")}
          </DropdownMenuItem>

          {/* Date Format Sub-menu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={isUpdatingDateFormat}>
              {isUpdatingDateFormat ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="mr-2 h-4 w-4" />
              )}
              {t("dateFormat")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={currentDateFormat}
                onValueChange={handleDateFormatChange}
              >
                {DATE_FORMAT_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                    disabled={isUpdatingDateFormat}
                  >
                    {option.label}
                    <DropdownMenuShortcut>
                      {format(exampleDate, option.dateFns)}
                    </DropdownMenuShortcut>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Push Notifications Toggle */}
          {canTogglePush && (
            <DropdownMenuItem
              onClick={handlePushToggle}
              disabled={pushLoading}
            >
              {pushLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                pushStatusIcon
              )}
              {t("notifications")}
              {pushEnabled && (
                <DropdownMenuShortcut>
                  <Check className="h-3 w-3" />
                </DropdownMenuShortcut>
              )}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Settings */}
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <Settings className="mr-2 h-4 w-4" />
              {t("settings")}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Logout */}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile Edit Sheet */}
      <ProfileEditSheet
        open={profileSheetOpen}
        onOpenChange={setProfileSheetOpen}
      />
    </>
  );
}
