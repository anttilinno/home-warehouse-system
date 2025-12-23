"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, ComponentType } from "react";
import * as LucideIcons from "lucide-react";

// Map Lucide icon names to Material Symbols names
const materialIconMap: Record<string, string> = {
  // Navigation & Layout
  Home: "home",
  Package: "package_2",
  Tag: "sell",
  Archive: "layers",
  MapPin: "location_on",
  Box: "deployed_code",
  HandCoins: "sync_alt",
  Contact: "person",
  BarChart3: "bar_chart_4_bars",
  Settings: "settings",
  Bell: "notifications",
  User: "person",
  Users: "group",
  Layers: "menu_book",
  Warehouse: "warehouse",

  // Chevrons
  ChevronUp: "expand_less",
  ChevronDown: "expand_more",
  ChevronRight: "chevron_right",
  ChevronLeft: "chevron_left",

  // Actions
  Plus: "add",
  Search: "search",
  X: "close",
  Pencil: "edit",
  Trash2: "delete",
  Copy: "content_copy",
  Check: "check",

  // Auth
  LogIn: "login",
  LogOut: "logout",
  Globe: "language",

  // Dashboard
  DollarSign: "payments",
  AlertTriangle: "warning",
  AlertCircle: "error",
  Clock: "schedule",
  Shield: "shield",
  History: "history",

  // Misc
  Palette: "palette",
  Moon: "dark_mode",
  Sun: "light_mode",
  Gamepad2: "sports_esports",
  MoreVertical: "more_vert",
  MoreHorizontal: "more_horiz",
  ExternalLink: "open_in_new",
  Eye: "visibility",
  EyeOff: "visibility_off",
  Filter: "filter_list",
  Download: "download",
  Upload: "upload",
  Loader2: "progress_activity",
  RefreshCw: "sync",
  Building2: "apartment",
  Crown: "workspace_premium",
  UserPlus: "person_add",
  FolderTree: "folder_open",
};

interface IconProps {
  name: keyof typeof LucideIcons;
  className?: string;
  size?: number;
}

// Material Symbol component for retro themes
function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined ${className || ''}`}
      style={{
        fontSize: 'inherit',
        lineHeight: 1,
        verticalAlign: 'middle',
      }}
    >
      {name}
    </span>
  );
}

export function Icon({ name, className, size }: IconProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get the Lucide icon
  const LucideIcon = LucideIcons[name] as ComponentType<{ className?: string; size?: number }>;

  // Before mounting, render Lucide to avoid hydration mismatch
  if (!mounted || !LucideIcon) {
    if (LucideIcon) {
      return <LucideIcon className={className} size={size} />;
    }
    return null;
  }

  const isRetro = theme?.startsWith("retro");

  if (isRetro) {
    const materialName = materialIconMap[name as string];
    if (materialName) {
      return <MaterialIcon name={materialName} className={className} />;
    }
  }

  return <LucideIcon className={className} size={size} />;
}