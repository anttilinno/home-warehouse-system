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
  Star: "star",
  Smartphone: "smartphone",
  FileText: "description",
  QrCode: "qr_code_2",
  Zap: "bolt",

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
  style?: React.CSSProperties;
}

// Parse Tailwind size class to pixels for Material Symbols
function parseSizeClass(className?: string): number | null {
  if (!className) return null;
  // Match h-X or w-X patterns (Tailwind size classes)
  const match = className.match(/[hw]-(\d+)/);
  if (match) {
    const size = parseInt(match[1], 10);
    // Tailwind spacing is 4px per unit, but Material Symbols have
    // built-in optical padding, so we scale up by 1.5x to match Lucide visually
    return size * 6;
  }
  return null;
}

// Material Symbol component for retro themes
function MaterialIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const sizeInPx = parseSizeClass(className);

  return (
    <span
      className={`material-symbols-outlined ${className || ''}`}
      style={{
        fontSize: sizeInPx ? `${sizeInPx}px` : 'inherit',
        lineHeight: 1,
        width: sizeInPx ? `${sizeInPx}px` : undefined,
        height: sizeInPx ? `${sizeInPx}px` : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {name}
    </span>
  );
}

export function Icon({ name, className, size, style }: IconProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get the Lucide icon
  const LucideIcon = LucideIcons[name] as ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>;

  // Before mounting, render Lucide to avoid hydration mismatch
  if (!mounted || !LucideIcon) {
    if (LucideIcon) {
      return <LucideIcon className={className} size={size} style={style} />;
    }
    return null;
  }

  const isRetro = theme?.startsWith("retro");

  if (isRetro) {
    const materialName = materialIconMap[name as string];
    if (materialName) {
      return <MaterialIcon name={materialName} className={className} style={style} />;
    }
  }

  return <LucideIcon className={className} size={size} style={style} />;
}